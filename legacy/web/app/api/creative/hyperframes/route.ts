import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const GENERATE_SERVER_URL =
  process.env.GENERATE_SERVER_URL || "http://localhost:3001";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const resp = await fetch(
      `${GENERATE_SERVER_URL}/api/creative/hyperframes`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: request.headers.get("authorization") || "",
        },
        body: JSON.stringify(body),
      },
    );

    const text = await resp.text();
    return new NextResponse(text, {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[api/creative/hyperframes] proxy error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Proxy failed" },
      { status: 502 },
    );
  }
}
