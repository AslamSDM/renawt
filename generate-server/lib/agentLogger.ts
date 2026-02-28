/**
 * Agent Output Logger
 *
 * Logs each agent's input/output to files for debugging.
 * Files go to logs/agents/<agentName>_<timestamp>.json
 */

import fs from "fs";
import path from "path";

const AGENT_LOG_DIR = path.join(process.cwd(), "logs", "agents");

function ensureDir() {
  if (!fs.existsSync(AGENT_LOG_DIR)) {
    fs.mkdirSync(AGENT_LOG_DIR, { recursive: true });
  }
}

/**
 * Log agent input and output to a JSON file.
 */
export function logAgentOutput(
  agentName: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  durationMs: number,
): void {
  try {
    ensureDir();
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${agentName}_${ts}.json`;
    const filepath = path.join(AGENT_LOG_DIR, filename);

    const entry = {
      agent: agentName,
      timestamp: new Date().toISOString(),
      durationMs,
      input,
      output,
    };

    fs.writeFileSync(filepath, JSON.stringify(entry, null, 2));
    console.log(
      `[AgentLogger] ${agentName} logged to ${filename} (${durationMs}ms)`,
    );
  } catch (err) {
    console.error(`[AgentLogger] Failed to log ${agentName}:`, err);
  }
}

/**
 * Helper to time an agent call and log it.
 */
export async function withAgentLogging<T extends Record<string, unknown>>(
  agentName: string,
  input: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    logAgentOutput(agentName, input, result, Date.now() - start);
    return result;
  } catch (err) {
    logAgentOutput(
      agentName,
      input,
      {
        error: err instanceof Error ? err.message : String(err),
        currentStep: "error",
      },
      Date.now() - start,
    );
    throw err;
  }
}
