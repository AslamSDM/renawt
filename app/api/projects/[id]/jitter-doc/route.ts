import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { sanitizeR2UrlsDeep } from "@/lib/storage/r2";

const MAX_HISTORY = 30;

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
  return { project, userId: session.user.id };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authorize(id);
  if ("error" in auth) return auth.error;

  // Heal any private R2 urls stored before R2_PUBLIC_URL was set — the in-browser
  // Remotion <Player> ORB-blocks the S3 endpoint just like the renderer does.
  const doc = auth.project.jitterDoc
    ? sanitizeR2UrlsDeep(JSON.parse(auth.project.jitterDoc))
    : null;
  const historyCount = await prisma.jitterDocHistory.count({ where: { projectId: id } });

  return NextResponse.json({ doc, historyCount });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authResult = await authorize(id);
  if ("error" in authResult) return authResult.error;

  const body = await request.json();
  if (!body?.doc) {
    return NextResponse.json({ error: "doc required" }, { status: 400 });
  }

  const newDocStr = JSON.stringify(body.doc);
  const prior = authResult.project.jitterDoc;

  await prisma.$transaction(async (tx) => {
    if (prior && prior !== newDocStr) {
      await tx.jitterDocHistory.create({
        data: { projectId: id, doc: prior, label: body.label ?? null },
      });
      const all = await tx.jitterDocHistory.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (all.length > MAX_HISTORY) {
        const stale = all.slice(MAX_HISTORY).map((r) => r.id);
        await tx.jitterDocHistory.deleteMany({ where: { id: { in: stale } } });
      }
    }
    await tx.project.update({
      where: { id },
      data: { jitterDoc: newDocStr },
    });
  });

  const historyCount = await prisma.jitterDocHistory.count({ where: { projectId: id } });
  return NextResponse.json({ ok: true, historyCount });
}
