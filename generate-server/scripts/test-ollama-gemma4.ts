/**
 * Quick sanity test for the Gemma 4 turn-marker path in chatWithOllama.
 *   tsx generate-server/scripts/test-ollama-gemma4.ts
 *   OLLAMA_MODEL=gemma4:26b tsx generate-server/scripts/test-ollama-gemma4.ts
 */
process.env.LLM_PROVIDER = "ollama";
process.env.OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
process.env.OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:26b";

import { chatWithOllama } from "../lib/agents/model";

async function main() {
  const r = await chatWithOllama(
    [
      { role: "system", content: "You are a precise reasoning assistant." },
      {
        role: "user",
        content:
          "A train leaves at 8:15 AM and arrives at 11:47 AM. How long was the journey?",
      },
    ],
    { temperature: 0.2 },
  );
  console.log("\n=== ANSWER ===\n" + r.content);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
