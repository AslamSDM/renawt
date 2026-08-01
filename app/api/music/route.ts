import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const tracks = await prisma.music.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ tracks });
  } catch (err) {
    console.error("[api/music] failed:", err);
    return NextResponse.json({ error: "Failed to fetch music tracks" }, { status: 500 });
  }
}
