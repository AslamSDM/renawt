import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import "dotenv/config";

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Aslam <aslam@remawt.com>";
const SELF = "masladarkshark@gmail.com";
const SLEEP_MS = 1100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const bodyActive = (firstName, credits) => `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>Hey ${firstName},</h2>
  <p>Thanks for sticking with Remawt — you've still got <strong>${credits} credits</strong> on your account.</p>
  <p>Just shipped something I think you'll like: <strong>Reference Video Generator</strong>. Drop in a reference clip, and Remawt mirrors its style, pacing, and structure when generating your next video. Way faster than describing the vibe in words.</p>
  <p>Try it: <a href="https://remawt.com">remawt.com</a></p>
  <p>Would love your feedback — just hit reply.</p>
  <p>— Aslam</p>
</div>`;

const bodyInactive = (firstName) => `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>Hey ${firstName},</h2>
  <p>It's Aslam from Remawt. Noticed you haven't been around — wanted to share what's new.</p>
  <p>Just shipped <strong>Reference Video Generator</strong>: drop in any reference clip and Remawt mirrors its style, pacing, and structure. No more wrestling with prompts to nail the vibe.</p>
  <p>Come try it: <a href="https://remawt.com">remawt.com</a></p>
  <p>If something blocked you last time, reply and tell me — I read every email.</p>
  <p>— Aslam</p>
</div>`;

const users = await prisma.user.findMany({
  where: { email: { not: null, notIn: [SELF] } },
  select: { email: true, name: true, creditBalance: true },
});

console.log(`Sending to ${users.length} users (skipped self)\n`);

const results = { sent: 0, failed: 0, errors: [] };

for (const u of users) {
  const firstName = u.name?.split(" ")[0] || "there";
  const isActive = u.creditBalance > 0;
  const subject = isActive
    ? "New in Remawt: Reference Video Generator"
    : "Come back to Remawt — new Reference Video Generator";
  const html = isActive
    ? bodyActive(firstName, u.creditBalance)
    : bodyInactive(firstName);

  try {
    const res = await resend.emails.send({
      from: FROM,
      to: u.email,
      subject,
      html,
    });
    if (res.error) throw new Error(JSON.stringify(res.error));
    results.sent++;
    console.log(`[${results.sent}/${users.length}] ✓ ${u.email} (${isActive ? "active" : "inactive"})`);
  } catch (err) {
    results.failed++;
    results.errors.push({ email: u.email, error: err.message });
    console.log(`[${results.sent + results.failed}/${users.length}] ✗ ${u.email} — ${err.message}`);
  }
  await sleep(SLEEP_MS);
}

console.log(`\nDone. Sent: ${results.sent}, Failed: ${results.failed}`);
if (results.errors.length) console.log("Errors:", JSON.stringify(results.errors, null, 2));

await prisma.$disconnect();
