import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOST = "pub-d842b814c7c64f5caefc4f21e1f4ef6b.r2.dev";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  try {
    const parsed = new URL(url);
    if (parsed.host !== ALLOWED_HOST) {
      return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
    }

    const upstream = await fetch(url);
    if (!upstream.ok) {
      return new NextResponse("Upstream error", { status: upstream.status });
    }

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "video/mp4",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
}
