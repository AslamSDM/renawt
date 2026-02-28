/**
 * Security validation for generated Remotion code.
 * Blocks dangerous patterns before the code is written to disk and executed.
 */

const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  // Node.js built-in modules
  { pattern: /\brequire\s*\(\s*['"`](?:child_process|fs|net|http|https|os|dgram|cluster|tls|dns|readline|vm|worker_threads|crypto)['"`]\s*\)/, description: "Import of dangerous Node.js module" },
  { pattern: /from\s+['"`](?:child_process|fs|net|http|https|os|dgram|cluster|tls|dns|readline|vm|worker_threads)['"`]/, description: "Import of dangerous Node.js module" },
  { pattern: /import\s*\(\s*['"`](?:child_process|fs|net|http|https|os|dgram|cluster|tls|dns|readline|vm|worker_threads)['"`]\s*\)/, description: "Dynamic import of dangerous module" },

  // Code execution
  { pattern: /\beval\s*\(/, description: "Use of eval()" },
  { pattern: /\bnew\s+Function\s*\(/, description: "Use of Function constructor" },

  // Process/env access
  { pattern: /\bprocess\s*\.\s*(?:env|exit|kill|execPath|argv)/, description: "Access to process object" },
  { pattern: /\bglobal(?:This)?\s*\[/, description: "Dynamic global access" },

  // Shell execution
  { pattern: /\bexec(?:Sync|File|FileSync)?\s*\(/, description: "Shell command execution" },
  { pattern: /\bspawn(?:Sync)?\s*\(/, description: "Process spawning" },

  // Network exfiltration (allow fetch to known-safe domains for images)
  { pattern: /\bnew\s+(?:WebSocket|XMLHttpRequest)\s*\(/, description: "Network connection" },

  // File system access (outside of remotion's staticFile)
  { pattern: /\b(?:readFile|writeFile|readdir|mkdir|rmdir|unlink|rename|copyFile|appendFile)(?:Sync)?\s*\(/, description: "Direct filesystem access" },
];

export interface CodeValidationResult {
  safe: boolean;
  violations: string[];
}

/**
 * Validate generated code for dangerous patterns.
 * Returns { safe: true } if no issues found, or { safe: false, violations: [...] }.
 */
export function validateGeneratedCode(code: string): CodeValidationResult {
  const violations: string[] = [];

  for (const { pattern, description } of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      violations.push(description);
    }
  }

  return {
    safe: violations.length === 0,
    violations,
  };
}
