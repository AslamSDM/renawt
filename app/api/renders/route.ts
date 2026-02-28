import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const rendersDir = path.join(process.cwd(), "public", "renders");

    if (!fs.existsSync(rendersDir)) {
      return NextResponse.json({ videos: [] });
    }

    const files = fs.readdirSync(rendersDir);
    // Filter for mp4 files
    const videos = files
      .filter((file) => file.endsWith(".mp4"))
      .map((file) => `/renders/${file}`);

    // Optionally sort or limit them here.
    // We will just return all and let the client handle it.
    return NextResponse.json({ videos });
  } catch (error) {
    console.error("Error fetching renders:", error);
    return NextResponse.json(
      { error: "Failed to fetch renders" },
      { status: 500 },
    );
  }
}
