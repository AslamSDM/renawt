import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      where: {
        videoUrl: { not: null },
        status: { in: ["READY", "EXPORTED"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        videoUrl: true,
        sourceUrl: true,
        updatedAt: true,
        status: true,
      },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Error fetching showcase:", error);
    return NextResponse.json({ projects: [] }, { status: 200 });
  }
}
