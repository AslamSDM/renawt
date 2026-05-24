import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rows = await prisma.project.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        generations: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            videoUrl: true,
            createdAt: true,
            startedAt: true,
            finishedAt: true,
          },
        },
        _count: { select: { generations: true } },
      },
    });

    const projects = rows.map((p) => {
      const latest = p.generations[0] ?? null;
      const ongoing = latest?.status === "RUNNING";
      return {
        id: p.id,
        userId: p.userId,
        name: p.name,
        sourceUrl: p.sourceUrl,
        description: p.description,
        status: ongoing ? "GENERATING" : p.status,
        videoUrl: p.videoUrl ?? latest?.videoUrl ?? null,
        generationCount: p._count.generations,
        latestGeneration: latest,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();

    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        name: body.name,
        sourceUrl: body.sourceUrl,
        description: body.description,
        productData: body.productData ? JSON.stringify(body.productData) : null,
        script: body.script ? JSON.stringify(body.script) : null,
        composition: body.composition,
        audioUrl: body.audioUrl,
        status: body.status || "DRAFT",
      },
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
