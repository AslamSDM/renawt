/**
 * Backfill: rewrite private R2 S3-endpoint urls
 * (`<bucket>.<account>.r2.cloudflarestorage.com/<key>`) → the public domain url
 * across stored JitterDocs. Private urls are ORB-blocked in the browser <Player>
 * and the Remotion renderer, so they render as blank images / hang the render.
 *
 * Idempotent — only rows containing a private url are touched.
 *
 *   npx tsx scripts/backfill-r2-public-urls.ts          # dry run
 *   npx tsx scripts/backfill-r2-public-urls.ts --write   # apply
 */
import { prisma } from "../lib/db/prisma";
import { sanitizeR2UrlsDeep } from "../lib/storage/r2";

const WRITE = process.argv.includes("--write");
const PRIVATE_RE = /r2\.cloudflarestorage\.com/;

async function main() {
  if (!process.env.R2_PUBLIC_URL) {
    throw new Error("R2_PUBLIC_URL must be set to rewrite urls.");
  }
  console.log(WRITE ? "[backfill] WRITE mode" : "[backfill] DRY RUN (pass --write to apply)");

  // 1. Project.jitterDoc
  const projects = await prisma.project.findMany({
    where: { jitterDoc: { contains: "r2.cloudflarestorage.com" } },
    select: { id: true, jitterDoc: true },
  });
  let projFixed = 0;
  for (const p of projects) {
    if (!p.jitterDoc || !PRIVATE_RE.test(p.jitterDoc)) continue;
    const healed = JSON.stringify(sanitizeR2UrlsDeep(JSON.parse(p.jitterDoc)));
    if (healed === p.jitterDoc) continue;
    projFixed++;
    console.log(`  project ${p.id}: ${(p.jitterDoc.match(PRIVATE_RE) || []).length} private url(s)`);
    if (WRITE) {
      await prisma.project.update({ where: { id: p.id }, data: { jitterDoc: healed } });
    }
  }
  console.log(`[backfill] projects: ${projFixed}/${projects.length} ${WRITE ? "updated" : "would update"}`);

  // 2. JitterDocHistory.doc
  const history = await prisma.jitterDocHistory.findMany({
    where: { doc: { contains: "r2.cloudflarestorage.com" } },
    select: { id: true, doc: true },
  });
  let histFixed = 0;
  for (const h of history) {
    if (!h.doc || !PRIVATE_RE.test(h.doc)) continue;
    const healed = JSON.stringify(sanitizeR2UrlsDeep(JSON.parse(h.doc)));
    if (healed === h.doc) continue;
    histFixed++;
    if (WRITE) {
      await prisma.jitterDocHistory.update({ where: { id: h.id }, data: { doc: healed } });
    }
  }
  console.log(`[backfill] history: ${histFixed}/${history.length} ${WRITE ? "updated" : "would update"}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
