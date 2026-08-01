#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# remawt — AWS deployment (render Lambda + SQS + generate-server on ECS)
#
# Prereqs: aws cli, docker, jq, region/account below.
# Run:      ./deploy.sh all          # full pipeline
#           ./deploy.sh render       # render Lambda + queue only
#           ./deploy.sh backend      # generate-server ECS only
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
STAGE="${STAGE:-prod}"

ECR_RENDER_REPO="remawt/render-lambda"
ECR_BACKEND_REPO="remawt/generate-server"
SQS_QUEUE="remawt-render-jobs-${STAGE}"
LAMBDA_NAME="remawt-render-${STAGE}"
ECS_CLUSTER="remawt-${STAGE}"
ECS_SERVICE="generate-server-${STAGE}"
ALB_NAME="remawt-${STAGE}-alb"
TAG="$(git rev-parse --short HEAD 2>/dev/null || echo latest)"

echo "==> account=${ACCOUNT_ID} region=${AWS_REGION} stage=${STAGE} tag=${TAG}"

# ── 1. Render Lambda (ECR image + SQS) ───────────────────────────────────────
deploy_render() {
  # 1a. ECR repo + auth
  aws ecr create-repository --repository-name "$ECR_RENDER_REPO" --region "$AWS_REGION" >/dev/null 2>&1 || true
  aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com" >/dev/null

  # 1b. Build + push (linux/amd64, no provenance attestation manifests —
  # Lambda rejects multi-manifest indexes)
  docker buildx build --platform linux/amd64 --provenance=false \
    -t "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_RENDER_REPO:$TAG" \
    --push deploy/aws/render-lambda

  # 1c. SQS queue (standard, with DLQ)
  aws sqs create-queue --queue-name "$SQS_QUEUE" --region "$AWS_REGION" \
    --attributes '{"VisibilityTimeout":"900","MessageRetentionPeriod":"1209600"}' >/dev/null 2>&1 || true
  QUEUE_URL="$(aws sqs get-queue-url --queue-name "$SQS_QUEUE" --region "$AWS_REGION" --query QueueUrl --output text)"
  echo "==> queue: $QUEUE_URL"

  # 1d. IAM role for Lambda (SQS trigger + R2 via env creds; no AWS S3 needed)
  ROLE_NAME="remawt-render-lambda-role"
  ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query Role.Arn --output text 2>/dev/null || true)"
  if [ -z "$ROLE_ARN" ]; then
    aws iam create-role --role-name "$ROLE_NAME" \
      --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":["lambda.amazonaws.com"]},"Action":"sts:AssumeRole"}]}' \
      >/dev/null
    aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
    aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaSQSQueueExecutionRole"
    echo "==> created IAM role $ROLE_NAME"
  fi
  ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query Role.Arn --output text)"

  # 1e. Lambda function (container image). 15 min cap, 3008MB mem (account quota), 10GB /tmp.
  IMAGE_URI="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_RENDER_REPO:$TAG"
  R2_ENVS="R2_ACCOUNT_ID=${R2_ACCOUNT_ID:-},R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID:-},R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY:-},R2_BUCKET_NAME=${R2_BUCKET_NAME:-remawt-videos},R2_PUBLIC_URL=${R2_PUBLIC_URL:-}"
  # PUPPETEER_DANGEROUS_NO_SANDBOX: Chromium must run without sandbox in Lambda.
  # PRODUCER_HEADLESS_SHELL_PATH is baked into the image ENV (headless shell is
  # required — full Chromium's process model hangs under Firecracker seccomp).
  RENDER_LAMBDA_ENVS="PUPPETEER_DANGEROUS_NO_SANDBOX=true,$R2_ENVS"

  if aws lambda get-function --function-name "$LAMBDA_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
    aws lambda update-function-code --function-name "$LAMBDA_NAME" --image-uri "$IMAGE_URI" --region "$AWS_REGION" >/dev/null
    aws lambda update-function-configuration --function-name "$LAMBDA_NAME" \
      --memory-size 3008 --timeout 900 --ephemeral-storage Size=10240 \
      --environment "Variables={$RENDER_LAMBDA_ENVS}" --region "$AWS_REGION" >/dev/null
    echo "==> updated $LAMBDA_NAME"
  else
    aws lambda create-function --function-name "$LAMBDA_NAME" \
      --package-type Image --code ImageUri="$IMAGE_URI" --role "$ROLE_ARN" \
      --memory-size 3008 --timeout 900 --ephemeral-storage Size=10240 \
      --environment "Variables={$RENDER_LAMBDA_ENVS}" --region "$AWS_REGION" >/dev/null
    echo "==> created $LAMBDA_NAME"
  fi

  # 1f. SQS event source (batch size 1 → one render per invocation)
  FN_ARN="$(aws lambda get-function --function-name "$LAMBDA_NAME" --region "$AWS_REGION" --query Configuration.FunctionArn --output text)"
  QUEUE_ARN="$(aws sqs get-queue-attributes --queue-url "$QUEUE_URL" --region "$AWS_REGION" --attribute-names QueueArn --query Attributes.QueueArn --output text)"
  aws lambda create-event-source-mapping --function-name "$FN_ARN" --event-source-arn "$QUEUE_ARN" --batch-size 1 --region "$AWS_REGION" >/dev/null 2>&1 || true
  echo "==> event source attached (batch=1)"

  echo ""
  echo "==> Render Lambda ready. Set in generate-server env:"
  echo "    RENDER_QUEUE_URL=$QUEUE_URL"
  echo "    AWS_REGION=$AWS_REGION"
  echo "    (IAM role or access keys for SQS SendMessage)"
}

# ── 2. generate-server backend on ECS Fargate ────────────────────────────────
deploy_backend() {
  # 2a. ECR repo
  aws ecr create-repository --repository-name "$ECR_BACKEND_REPO" --region "$AWS_REGION" >/dev/null 2>&1 || true
  aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com" >/dev/null

  docker buildx build --platform linux/amd64 --provenance=false \
    -t "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_BACKEND_REPO:$TAG" \
    --push generate-server

  # 2b. ECS cluster
  aws ecs create-cluster --cluster-name "$ECS_CLUSTER" --region "$AWS_REGION" >/dev/null 2>&1 || true

  # 2c. ALB + target group + listener
  VPC_ID="$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text --region "$AWS_REGION")"
  SG_NAME="remawt-backend-sg"
  SG_ID="$(aws ec2 describe-security-groups --filters Name=group-name,Values="$SG_NAME" --query 'SecurityGroups[0].GroupId' --output text --region "$AWS_REGION" 2>/dev/null || true)"
  if [ -z "$SG_ID" ] || [ "$SG_ID" = "None" ]; then
    SG_ID="$(aws ec2 create-security-group --group-name "$SG_NAME" --description "remawt backend" --vpc-id "$VPC_ID" --region "$AWS_REGION" --query GroupId --output text)"
    aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0 --region "$AWS_REGION" >/dev/null 2>&1 || true
    aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 3001 --cidr 0.0.0.0/0 --region "$AWS_REGION" >/dev/null 2>&1 || true
  fi

  SUBNETS="$(aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC_ID" --query 'Subnets[?DefaultForAz==`true`].SubnetId' --output text --region "$AWS_REGION" | tr '\t' ',')"

  ALB_ARN="$(aws elbv2 create-load-balancer --name "$ALB_NAME" --subnets ${SUBNETS//,/ } --security-groups "$SG_ID" --scheme internet-facing --type application --region "$AWS_REGION" --query LoadBalancers[0].LoadBalancerArn --output text)"
  TG_ARN="$(aws elbv2 create-target-group --name "remawt-backend-tg" --protocol HTTP --port 3001 --vpc-id "$VPC_ID" --target-type ip --health-check-path /health --region "$AWS_REGION" --query TargetGroups[0].TargetGroupArn --output text)"
  aws elbv2 create-listener --load-balancer-arn "$ALB_ARN" --protocol HTTP --port 80 --default-actions Type=forward,TargetGroupArn="$TG_ARN" --region "$AWS_REGION" >/dev/null
  ALB_DNS="$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" --query 'LoadBalancers[0].DNSName' --output text --region "$AWS_REGION")"
  echo "==> ALB: $ALB_DNS"

  # 2d. ECS task definition — every var in generate-server/.env is injected as
  # a plain environment entry (fine for a private API; use SecretsManager if
  # you prefer encrypted storage).
  TASK_JSON="/tmp/remawt-taskdef.json"
  ENV_JSON=""
  ENV_FILE="$(cd "$(dirname "$0")" && cd ../../generate-server && pwd)/.env"
  if [ -f "$ENV_FILE" ]; then
    ENV_JSON="$(awk -F= '!/^#/ && /^[A-Za-z_][A-Za-z0-9_]*=/ {
      key=$1; val=substr($0, index($0,"=")+1)
      gsub(/^["\x27]|["\x27]$/, "", val)
      printf "      {\"name\": \"%s\", \"value\": \"%s\"},\n", key, val
    }' "$ENV_FILE")"
  fi
  # Overrides / additions for the AWS path (real newlines — not literal \n)
  ENV_JSON="$ENV_JSON"$'\n'"      {\"name\": \"RENDER_QUEUE_URL\", \"value\": \"https://sqs.$AWS_REGION.amazonaws.com/$ACCOUNT_ID/$SQS_QUEUE\"},"
  ENV_JSON="$ENV_JSON"$'\n'"      {\"name\": \"AWS_REGION\", \"value\": \"$AWS_REGION\"}"

  cat > "$TASK_JSON" <<EOF
{
  "family": "$ECS_SERVICE",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::$ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [{
    "name": "generate-server",
    "image": "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_BACKEND_REPO:$TAG",
    "portMappings": [{"containerPort": 3001, "protocol": "tcp"}],
    "essential": true,
    "environment": [
      {"name": "PORT", "value": "3001"},
      {"name": "NODE_ENV", "value": "production"},
$ENV_JSON
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/remawt",
        "awslogs-region": "$AWS_REGION",
        "awslogs-stream-prefix": "generate-server"
      }
    }
  }]
}
EOF
  # NOTE: anything else in generate-server/.env (ElevenLabs, Gemini, Dodo, etc.)
  # must be added above as env vars or SecretsManager entries. See README.

  TASK_REV="$(aws ecs register-task-definition --cli-input-json file://$TASK_JSON --region "$AWS_REGION" --query taskDefinition.revision --output text)"
  SERVICE_JSON="/tmp/remawt-service.json"
  cat > "$SERVICE_JSON" <<EOF
{
  "cluster": "$ECS_CLUSTER",
  "serviceName": "$ECS_SERVICE",
  "taskDefinition": "$ECS_SERVICE:$TASK_REV",
  "desiredCount": 1,
  "launchType": "FARGATE",
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": [${SUBNETS//,/", "}],
      "securityGroups": ["$SG_ID"],
      "assignPublicIp": "ENABLED"
    }
  },
  "loadBalancers": [{
    "targetGroupArn": "$TG_ARN",
    "containerName": "generate-server",
    "containerPort": 3001
  }]
}
EOF
  aws ecs create-service --cli-input-json file://$SERVICE_JSON --region "$AWS_REGION" >/dev/null 2>&1 || \
  aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" \
    --task-definition "$ECS_SERVICE:$TASK_REV" \
    --load-balancers targetGroupArn="$TG_ARN",containerName=generate-server,containerPort=3001 \
    --force-new-deployment --region "$AWS_REGION" >/dev/null

  echo ""
  echo "==> Backend deployed. Set in Vercel: NEXT_PUBLIC_API_URL=http://$ALB_DNS"
  echo "    (attach HTTPS via ACM cert + listener 443 for production)"
}

case "${1:-all}" in
  render) deploy_render ;;
  backend) deploy_backend ;;
  all) deploy_render && deploy_backend ;;
  *) echo "usage: $0 {all|render|backend}"; exit 1 ;;
esac
