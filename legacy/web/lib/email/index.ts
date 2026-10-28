import { Resend } from "resend";

const FROM_EMAIL = "Aslam <aslam@remawt.com>";

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendWelcomeEmail(to: string, name: string | null) {
  const firstName = name?.split(" ")[0] || "there";

  const resend = getResend();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set, skipping welcome email");
    return;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Welcome to Remawt!",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Hello ${firstName},</h2>
          <p>I'm Aslam, the founder of Remawt. I noticed that you recently signed up, and I would love to hear your feedback to help me improve the product for you.</p>
          <p>Please feel free to explore the platform and let me know if you encounter any issues or have any suggestions.</p>
          <p>Thanks,<br/>Aslam</p>
        </div>
      `,
    });
    console.log(`[Email] Welcome email sent to ${to}`);
  } catch (error) {
    console.error("[Email] Failed to send welcome email:", error);
  }
}

export async function sendSubscriptionEmail(
  to: string,
  name: string | null,
  plan: string,
) {
  const firstName = name?.split(" ")[0] || "there";
  // e.g. "SUBSCRIPTION_CREATOR" -> "Creator"
  const planName =
    plan.replace("SUBSCRIPTION_", "").charAt(0) +
    plan.replace("SUBSCRIPTION_", "").slice(1).toLowerCase();

  const resend = getResend();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set, skipping subscription email");
    return;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `You're now on the ${planName} plan!`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Hey ${firstName},</h2>
          <p>Thanks for subscribing to the <strong>${planName}</strong> plan! Your credits have been added to your account.</p>
          <p>If you have any questions or need help getting the most out of Remawt, just reply to this email.</p>
          <p>Thanks,<br/>Aslam</p>
        </div>
      `,
    });
    console.log(`[Email] Subscription email sent to ${to}`);
  } catch (error) {
    console.error("[Email] Failed to send subscription email:", error);
  }
}
