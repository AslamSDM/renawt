#!/usr/bin/env bash
# Local AWS emulation with Floci (https://floci.io) — mirrors the prod pipeline:
#   generate-server (host) → scraper-service (host) → SQS → Lambda (Floci Docker) → S3 (Floci)
# Prereqs: docker compose, Node 20+, Google Chrome installed, real R2/Ollama creds in generate-server/.env
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== 1/5 Starting Floci (SQS + S3 + Lambda + CloudWatch) =="
docker compose -f deploy/floci/docker-compose.yml up -d
sleep 6

export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

echo "== 2/5 Creating local resources =="
aws s3 mb s3://remawt-videos --endpoint-url $AWS_ENDPOINT_URL >/dev/null 2>&1 || true
aws sqs create-queue --queue-name remawt-render-jobs-prod --endpoint-url $AWS_ENDPOINT_URL >/dev/null

echo "== 3/5 Building + registering render Lambda (local arm64, full Chromium) =="
docker build --provenance=false -t remawt/render-lambda:local deploy/aws/render-lambda >/dev/null
aws lambda create-function \
  --function-name remawt-render-prod \
  --package-type Image \
  --code ImageUri=remawt/render-lambda:local \
  --role arn:aws:iam::000000000000:role/lambda-role \
  --timeout 600 --memory-size 3008 \
  --environment '{"Variables":{"R2_ACCOUNT_ID":"test","R2_ACCESS_KEY_ID":"test","R2_SECRET_ACCESS_KEY":"test","R2_BUCKET_NAME":"remawt-videos","R2_ENDPOINT":"http://floci:4566","R2_FORCE_PATH_STYLE":"true","R2_PUBLIC_URL":"http://host.docker.internal:4566/remawt-videos","AWS_REGION":"us-east-1","_HANDLER":"dist/handler.handler","LAMBDA_TASK_ROOT":"/app","PRODUCER_HEADLESS_SHELL_PATH":"/usr/lib/chromium/chromium","PUPPETEER_EXECUTABLE_PATH":"/usr/lib/chromium/chromium"}}' \
  --endpoint-url $AWS_ENDPOINT_URL --region us-east-1 >/dev/null 2>&1 || \
aws lambda update-function-configuration --function-name remawt-render-prod \
  --environment '{"Variables":{"R2_ACCOUNT_ID":"test","R2_ACCESS_KEY_ID":"test","R2_SECRET_ACCESS_KEY":"test","R2_BUCKET_NAME":"remawt-videos","R2_ENDPOINT":"http://floci:4566","R2_FORCE_PATH_STYLE":"true","R2_PUBLIC_URL":"http://host.docker.internal:4566/remawt-videos","AWS_REGION":"us-east-1","_HANDLER":"dist/handler.handler","LAMBDA_TASK_ROOT":"/app","PRODUCER_HEADLESS_SHELL_PATH":"/usr/lib/chromium/chromium","PUPPETEER_EXECUTABLE_PATH":"/usr/lib/chromium/chromium"}}' \
  --endpoint-url $AWS_ENDPOINT_URL --region us-east-1 >/dev/null

aws lambda create-event-source-mapping \
  --function-name remawt-render-prod \
  --event-source-arn arn:aws:sqs:us-east-1:000000000000:remawt-render-jobs-prod \
  --endpoint-url $AWS_ENDPOINT_URL --region us-east-1 >/dev/null 2>&1 || true

echo "== 4/5 Starting scraper-service on :4001 =="
( cd services/scraper-service && \
  PORT=4001 \
  SCRAPER_AUTH_TOKEN=48f6df41145abde36ebc587d6721a1fecfdf0d603aaff64b973a70e3dcac87fc \
  R2_ACCOUNT_ID=test R2_ACCESS_KEY_ID=test R2_SECRET_ACCESS_KEY=test \
  R2_BUCKET_NAME=remawt-videos R2_ENDPOINT=http://localhost:4566 R2_FORCE_PATH_STYLE=true \
  R2_PUBLIC_URL=http://localhost:4566/remawt-videos \
  PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  npx tsx src/server.ts > /tmp/scraper-local.log 2>&1 & )

echo "== 5/5 Starting generate-server on :3001 (Floci S3/SQS, real Ollama Cloud models) =="
( cd generate-server && \
  PORT=3001 \
  R2_ACCOUNT_ID=test R2_ACCESS_KEY_ID=test R2_SECRET_ACCESS_KEY=test \
  R2_BUCKET_NAME=remawt-videos R2_ENDPOINT=http://localhost:4566 R2_FORCE_PATH_STYLE=true \
  R2_PUBLIC_URL=http://host.docker.internal:4566/remawt-videos \
  RENDER_QUEUE_URL=http://localhost:4566/000000000000/remawt-render-jobs-prod \
  AWS_REGION=us-east-1 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test \
  npx tsx server.ts > /tmp/generate-local.log 2>&1 & )

echo "Local environment up:"
echo "  Floci API        http://localhost:4566"
echo "  generate-server  http://localhost:3001"
echo "  scraper-service  http://localhost:4001"
echo "Logs: /tmp/generate-local.log /tmp/scraper-local.log"
