import fs from "fs";
import path from "path";

// Skills directory path
const SKILLS_DIR = path.join(process.cwd(), ".agent", "skills", "remotion");
const PROMPTS_LOG_DIR = path.join(process.cwd(), "logs", "prompts");

/**
 * Load a specific skill rule file
 */
export function loadSkillRule(ruleName: string): string {
  const rulePath = path.join(SKILLS_DIR, "rules", `${ruleName}.md`);
  try {
    if (fs.existsSync(rulePath)) {
      return fs.readFileSync(rulePath, "utf-8");
    }
    console.warn(`[Skills] Rule file not found: ${rulePath}`);
    return "";
  } catch (error) {
    console.error(`[Skills] Error loading rule ${ruleName}:`, error);
    return "";
  }
}

/**
 * Load multiple skill rules and concatenate them
 */
export function loadSkillRules(ruleNames: string[]): string {
  const rules = ruleNames.map((name) => {
    const content = loadSkillRule(name);
    if (content) {
      return `\n## ${name.toUpperCase()} RULES\n${content}\n`;
    }
    return "";
  });
  return rules.join("\n---\n");
}

/**
 * Load all available remotion skills for code generation
 */
export function loadRemotionSkills(): string {
  const coreRules = ["animations", "timing", "sequencing", "text-animations"];
  return loadSkillRules(coreRules);
}

/**
 * Save prompt to a log file for debugging
 */
export function savePromptLog(
  agentName: string,
  systemPrompt: string,
  userPrompt: string,
  response?: string,
): void {
  try {
    // Ensure log directory exists
    if (!fs.existsSync(PROMPTS_LOG_DIR)) {
      fs.mkdirSync(PROMPTS_LOG_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${agentName}_${timestamp}.txt`;
    const filepath = path.join(PROMPTS_LOG_DIR, filename);

    const content = `================================================================================
AGENT: ${agentName}
TIMESTAMP: ${new Date().toISOString()}
================================================================================

=== SYSTEM PROMPT ===
${systemPrompt}

=== USER PROMPT ===
${userPrompt}

${response ? `=== RESPONSE ===\n${response}\n` : ""}
================================================================================
`;

    fs.writeFileSync(filepath, content);
    console.log(`[Skills] Prompt saved to: ${filepath}`);
  } catch (error) {
    console.error("[Skills] Error saving prompt log:", error);
  }
}

/**
 * Get the latest prompt logs
 */
export function getLatestPromptLogs(count: number = 5): string[] {
  try {
    if (!fs.existsSync(PROMPTS_LOG_DIR)) {
      return [];
    }
    const files = fs
      .readdirSync(PROMPTS_LOG_DIR)
      .filter((f) => f.endsWith(".txt"))
      .sort()
      .reverse()
      .slice(0, count);
    return files.map((f) => path.join(PROMPTS_LOG_DIR, f));
  } catch (error) {
    console.error("[Skills] Error reading prompt logs:", error);
    return [];
  }
}
