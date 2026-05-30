import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";

async function verifyCallbackToken(req?: NextRequest): Promise<boolean> {
  if (!req) return false;
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  const secret = process.env.API_KEY;
  if (!secret) return false;
  try {
    const { payload } = await jwtVerify(
      header.slice(7),
      new TextEncoder().encode(secret),
      { algorithms: ["HS256"], audience: "callback" },
    );
    return payload.sub === "internal-worker";
  } catch {
    return false;
  }
}

async function authorize(id: string, req?: NextRequest) {
  // Internal worker callback — JWT signed with API_KEY, aud:"callback".
  if (await verifyCallbackToken(req)) {
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return {
        error: NextResponse.json({ error: "Project not found" }, { status: 404 }),
      };
    }
    return { project, userId: project.userId ?? "internal" };
  }

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
  { params }: { params: Promise<{ id: string; gid: string }> },
) {
  const { id, gid } = await params;
  const a = await authorize(id, _req);
  if ("error" in a) return a.error;

  const row = await prisma.generation.findUnique({ where: { id: gid } });
  if (!row || row.projectId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    generation: {
      ...row,
      params: row.params ? safeJson(row.params) : null,
      doc: row.doc ? safeJson(row.doc) : null,
      brandReport: row.brandReport ? safeJson(row.brandReport) : null,
      music: row.music ? safeJson(row.music) : null,
      progress: row.progress ? safeJson(row.progress) ?? [] : [],
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; gid: string }> },
) {
  const { id, gid } = await params;
  const a = await authorize(id, request);
  if ("error" in a) return a.error;

  const body = await request.json().catch(() => ({}));

  const existing = await prisma.generation.findUnique({ where: { id: gid } });
  if (!existing || existing.projectId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Progress ping — append the step event to the JSON array. Collapses
  // consecutive events for the same step so a "running"→"done" pair replaces
  // rather than stacks. Returns early; never touches status/result fields.
  if (body.progressEvent && typeof body.progressEvent === "object") {
    const events: any[] = existing.progress ? safeJson(existing.progress) ?? [] : [];
    const ev = body.progressEvent;
    const lastIdx = events.length - 1;
    if (lastIdx >= 0 && events[lastIdx]?.step === ev.step) {
      events[lastIdx] = ev; // replace the running placeholder with the resolved event
    } else {
      events.push(ev);
    }
    const updated = await prisma.generation.update({
      where: { id: gid },
      data: { progress: JSON.stringify(events) },
    });
    return NextResponse.json({ ok: true, progress: safeJson(updated.progress ?? "[]") });
  }

  const data: Record<string, unknown> = {};
  if (body.status !== undefined) data.status = body.status;
  if (body.videoUrl !== undefined) data.videoUrl = body.videoUrl;
  if (body.error !== undefined) data.error = body.error;
  if (body.doc !== undefined) data.doc = body.doc ? JSON.stringify(body.doc) : null;
  if (body.brandReport !== undefined)
    data.brandReport = body.brandReport ? JSON.stringify(body.brandReport) : null;
  if (body.music !== undefined)
    data.music = body.music ? JSON.stringify(body.music) : null;
  if (body.docSummary !== undefined) {
    const existingParams = existing.params ? safeJson(existing.params) ?? {} : {};
    data.params = JSON.stringify({
      ...existingParams,
      docSummary: body.docSummary,
      brandReport: body.brandReport ?? existingParams.brandReport,
      music: body.music ?? existingParams.music,
    });
  }
  if (body.status === "SUCCEEDED" || body.status === "FAILED") {
    data.finishedAt = new Date();
  }

  const row = await prisma.generation.update({
    where: { id: gid },
    data,
  });

  if (body.status === "SUCCEEDED") {
    const projUpdate: Record<string, unknown> = { status: "READY" };
    if (row.videoUrl) projUpdate.videoUrl = row.videoUrl;
    if (row.doc) projUpdate.jitterDoc = row.doc;
    await prisma.project.update({ where: { id }, data: projUpdate });
  } else if (body.status === "FAILED") {
    await prisma.project.update({ where: { id }, data: { status: "DRAFT" } });
  }

  return NextResponse.json({ generation: row });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; gid: string }> },
) {
  const { id, gid } = await params;
  const a = await authorize(id);
  if ("error" in a) return a.error;

  const existing = await prisma.generation.findUnique({ where: { id: gid } });
  if (!existing || existing.projectId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.generation.delete({ where: { id: gid } });
  return NextResponse.json({ ok: true });
}

function safeJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
