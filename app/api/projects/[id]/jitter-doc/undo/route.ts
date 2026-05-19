import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";

async function authorize(id: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return { error: NextResponse.json({ error: "Project not found" }, { status: 404 }) };
  }
  if (project.userId && project.userId !== session.user.id) {
    return { error: NextResponse.json({ error: "Not authorized" }, { status: 403 }) };
  }
  return { project };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authResult = await authorize(id);
  if ("error" in authResult) return authResult.error;

  const latest = await prisma.jitterDocHistory.findFirst({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) {
    return NextResponse.json({ error: "Nothing to undo" }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id },
      data: { jitterDoc: latest.doc },
    });
    await tx.jitterDocHistory.delete({ where: { id: latest.id } });
  });

  const doc = JSON.parse(latest.doc);
  const historyCount = await prisma.jitterDocHistory.count({ where: { projectId: id } });
  return NextResponse.json({ doc, historyCount });
}
