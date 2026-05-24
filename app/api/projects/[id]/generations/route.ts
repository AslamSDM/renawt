import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";

async function authorize(id: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return {
      error: NextResponse.json({ error: "Project not found" }, { status: 404 }),
    };
  }
  if (project.userId && project.userId !== session.user.id) {
    return {
      error: NextResponse.json({ error: "Not authorized" }, { status: 403 }),
    };
  }
  return { project, userId: session.user.id };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const a = await authorize(id);
  if ("error" in a) return a.error;

  const rows = await prisma.generation.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      status: true,
      videoUrl: true,
      params: true,
      error: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    generations: rows.map((r) => ({
      ...r,
      params: r.params ? safeJson(r.params) : null,
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const a = await authorize(id);
  if ("error" in a) return a.error;

  const body = await request.json().catch(() => ({}));

  const row = await prisma.generation.create({
    data: {
      projectId: id,
      userId: a.userId,
      status: "RUNNING",
      params: body?.params ? JSON.stringify(body.params) : null,
    },
  });

  await prisma.project.update({
    where: { id },
    data: { status: "GENERATING" },
  });

  return NextResponse.json({ generation: row });
}

function safeJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
