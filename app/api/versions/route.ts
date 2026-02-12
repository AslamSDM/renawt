import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "remawt-videos";

const getR2Client = (): S3Client => {
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });
};

/**
 * POST /api/versions/save
 * Save version history to R2
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, versions } = await request.json();

    if (!projectId || !versions) {
      return NextResponse.json(
        { error: "Project ID and versions are required" },
        { status: 400 }
      );
    }

    const client = getR2Client();
    const key = `versions/${projectId}/history.json`;

    // Save versions as JSON
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(versions, null, 2),
      ContentType: "application/json",
    });

    await client.send(command);

    return NextResponse.json({
      success: true,
      message: "Versions saved successfully",
    });
  } catch (error) {
    console.error("[API] Failed to save versions:", error);
    return NextResponse.json(
      { error: "Failed to save versions" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/versions/load?projectId=xxx
 * Load version history from R2
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    const client = getR2Client();
    const key = `versions/${projectId}/history.json`;

    try {
      const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      });

      const response = await client.send(command);
      const body = await response.Body?.transformToString();
      
      if (!body) {
        return NextResponse.json({ versions: [] });
      }

      const versions = JSON.parse(body);
      return NextResponse.json({ versions });
    } catch (error: any) {
      // If file doesn't exist, return empty array
      if (error.name === "NoSuchKey") {
        return NextResponse.json({ versions: [] });
      }
      throw error;
    }
  } catch (error) {
    console.error("[API] Failed to load versions:", error);
    return NextResponse.json(
      { error: "Failed to load versions" },
      { status: 500 }
    );
  }
}
