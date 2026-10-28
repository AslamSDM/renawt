import { spawn } from "child_process";
import DodoPayments from 'dodopayments';

import { config } from "dotenv";
config({ path: ".env" });

const dodoPaymentsApiKey = process.env.DODO_PAYMENTS_API_KEY;
const dodoWebhookId = process.env.DODO_WEBHOOK_ID;

if (!dodoPaymentsApiKey || !dodoWebhookId) {
    console.error("Missing required environment variables. Please check your .env.local file.");
    process.exit(1);
}

// dodo client
export const dodo = new DodoPayments({
    bearerToken: dodoPaymentsApiKey,
    environment: "test_mode",
});

const cloudflared = spawn("cloudflared", [
    "tunnel",
    "--url", "http://localhost:3000",
], { stdio: ["ignore", "pipe", "pipe"] });

cloudflared.stderr.on("data", async (data) => {
    const output = data.toString();
    const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);

    if (match) {
        const url = match[0];
        console.log("Public URL:", url);

        const webhookDetails = await dodo.webhooks.update(
            dodoWebhookId,
            {
                url: `${url}/api/dodo/webhook`,
            }
        );

        console.log(webhookDetails)
    }
});

cloudflared.stdout.on("data", async (data) => {
    console.log(data.toString());
});

cloudflared.on("close", (code) => {
    console.log(`Cloudflared process exited with code ${code}`);
});