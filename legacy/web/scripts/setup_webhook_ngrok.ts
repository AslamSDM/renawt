import { spawn } from "child_process";
import DodoPayments from 'dodopayments';

import { config } from "dotenv";
config({ path: ".env.local" });

const dodoPaymentsApiKey = process.env.DODO_PAYMENTS_API_KEY;
const ngrokAuthToken = process.env.NGROK_AUTH_TOKEN;
const dodoWebhookId = process.env.DODO_WEBHOOK_ID;

if (!dodoPaymentsApiKey || !ngrokAuthToken || !dodoWebhookId) {
    console.error("Missing required environment variables. Please check your .env.local file.");
    process.exit(1);
}

// dodo client
export const dodo = new DodoPayments({
    bearerToken: dodoPaymentsApiKey,
    environment: "test_mode",
});

// ngrok setup
// const ngrok = spawn("ngrok", ["http", "3000", "--authtoken", ngrokAuthToken, "--log=stdout", "--log-format=json"]);
const ngrok = spawn("ngrok", [
    "http",
    "3000",
    "--authtoken", ngrokAuthToken,
    "--log=stdout",
    "--log-format=json"
], { stdio: ["pipe", "pipe", "pipe"] });

ngrok.stdout.on("data", async (data) => {
    const output = data.toString();
    const match = output.match(/"url":"(https?:\/\/[^\"]+)"/);
    if (match) {
        console.log("Public URL:", match[1]);

        const webhookDetails = await dodo.webhooks.update(
            dodoWebhookId,
            {
                url: `${match[1]}/api/dodo/webhook`,
            }
        );

        console.log(webhookDetails)

    }
});

ngrok.stderr.on("data", (data) => {
    console.error("Ngrok error:", data.toString());
});

ngrok.on("close", (code) => {
    console.log(`Ngrok process exited with code ${code}`);
});