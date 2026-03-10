/**
 * RENDER ERROR FIXER AGENT
 *
 * Fixes Remotion code that failed to render.
 * Analyzes the error and asks the LLM to fix the code.
 */

import { chatWithGeminiFlash } from "./model";
import type { VideoGenerationStateType } from "./state";

const RENDER_ERROR_FIXER_SYSTEM_PROMPT = `You are a Remotion and TypeScript expert who fixes rendering errors.

## YOUR TASK

Analyze the render error below and fix the Remotion code to make it render successfully.

## COMMON RENDER ERRORS AND FIXES

1. **"Cannot find module" or import errors:**
   - Ensure all imports are correct
   - Add missing imports from 'remotion'
   - NEVER import from relative paths like '../components/...' or './utils/...' — the render service has no local files. INLINE all component code directly in the composition file.

2. **"X is not defined" or reference errors:**
   - Define missing variables
   - Fix variable scope issues
   - Add proper TypeScript types

3. **"Cannot read property of undefined" or null errors:**
   - Add null checks
   - Provide default values
   - Ensure props are properly typed

4. **Hook usage errors:**
   - Ensure hooks are called at the top level of components
   - Don't call hooks inside loops or conditions
   - Only call Remotion hooks inside components

5. **JSX/Syntax errors:**
   - Ensure all tags are properly closed
   - Fix mismatched brackets/parentheses
   - Ensure proper JSX syntax

6. **"window is not defined" or SSR errors:**
   - Don't use browser APIs (window, document, localStorage)
   - Use Remotion's safe APIs instead
   - Wrap browser-only code in useEffect

7. **Animation errors:**
   - Ensure interpolate() receives valid numbers
   - Check frame ranges are valid
   - Ensure spring() config is valid

## RULES

1. Return ONLY the fixed code - no explanations
2. Keep the visual design and animations the same
3. Fix ALL errors mentioned
4. Ensure the code is complete and valid
5. MUST end with: export default VideoComposition;`;

/**
 * Auto-fix common syntax errors before sending to LLM
 */
function autoFixCommonErrors(code: string): { code: string; fixed: boolean } {
  let fixedCode = code;
  let fixed = false;

  // Fix -1: Strip relative imports — single-line and multiline
  const singleLineRelative =
    /^import\s+.*?\s+from\s+['"](?:\.\.|\.\/)[^'"]*['"]\s*;?\s*$/gm;
  if (singleLineRelative.test(fixedCode)) {
    fixedCode = fixedCode.replace(singleLineRelative, "");
    fixed = true;
    console.log("[RenderErrorFixer] Stripped single-line relative imports");
  }
  const multiLineRelative =
    /import\s+(?:type\s+)?\{[^}]*\}\s*from\s*['"](?:\.\.|\.\/)[^'"]*['"]\s*;?/g;
  if (multiLineRelative.test(fixedCode)) {
    fixedCode = fixedCode.replace(
      /import\s+(?:type\s+)?\{[^}]*\}\s*from\s*['"](?:\.\.|\.\/)[^'"]*['"]\s*;?/g,
      "",
    );
    fixed = true;
    console.log("[RenderErrorFixer] Stripped multiline relative imports");
  }

  // Fix 0: Strip spread/rest operators from import statements (esbuild rejects `import { X, ...rest }`)
  fixedCode = fixedCode.replace(
    /import\s*\{([^}]*)\}\s*from/g,
    (match, imports) => {
      const cleaned = imports
        .split(",")
        .map((s: string) => s.trim())
        .filter((s: string) => s && !s.startsWith("..."))
        .join(", ");
      if (cleaned !== imports.trim()) {
        fixed = true;
        console.log("[RenderErrorFixer] Fixed spread operator in import statement");
      }
      return `import { ${cleaned} } from`;
    },
  );

  // Fix 1: Broken transform template literals like `translate(${x}px`, ${y}px)`
  // Should be: `translate(${x}px, ${y}px)`
  const brokenTransformPattern =
    /`([^`]*\$\{[^}]+\}px)`\s*,\s*\$\{([^}]+)\}px\)`/g;
  if (brokenTransformPattern.test(fixedCode)) {
    fixedCode = fixedCode.replace(
      brokenTransformPattern,
      (match, before, afterVar) => {
        fixed = true;
        return `\`${before}, \${${afterVar}}px)\``;
      },
    );
    console.log("[RenderErrorFixer] Fixed broken transform template literals");
  }

  // Fix 2: Unbalanced template literals in style objects
  // Pattern: style={{ transform: `...`something` }}
  const unbalancedStylePattern = /style=\{\{([^}]*?)`([^`]*?)`([^}]*?)\}\}/g;
  fixedCode = fixedCode.replace(
    unbalancedStylePattern,
    (match, before, content, after) => {
      // Check if there are odd number of backticks in the match
      const backtickCount = (match.match(/`/g) || []).length;
      if (backtickCount % 2 !== 0) {
        fixed = true;
        // Try to fix by adding a closing backtick before the }}}
        return match.replace(/}}\s*\}$/, "`}}");
      }
      return match;
    },
  );

  // Fix 3: Missing closing backtick in interpolate or spring calls
  const brokenInterpolatePattern =
    /interpolate\([^)]*`[^}]*\$\{[^}]+\}[^`]*$/gm;
  fixedCode = fixedCode.replace(brokenInterpolatePattern, (match) => {
    if (!match.endsWith("`")) {
      fixed = true;
      return match + "`";
    }
    return match;
  });

  return { code: fixedCode, fixed };
}

export async function renderErrorFixerNode(
  state: VideoGenerationStateType,
): Promise<Partial<VideoGenerationStateType>> {
  console.log("[RenderErrorFixer] Fixing render errors...");

  let remotionCode = state.remotionCode;
  const lastError = state.lastRenderError;

  if (!remotionCode) {
    return {
      errors: [ "No Remotion code available to fix"],
      currentStep: "error",
    };
  }

  if (!lastError) {
    return {
      errors: [ "No render error to fix"],
      currentStep: "error",
    };
  }

  // Check if we've exceeded max attempts
  if (state.renderAttempts >= 3) {
    console.error("[RenderErrorFixer] Max render attempts exceeded");
    return {
      errors: [ "Max render attempts exceeded"],
      currentStep: "error",
    };
  }

  // Skip LLM fix for infrastructure errors (timeouts, browser launch failures)
  const infraErrors = [
    "timed out",
    "TimeoutError",
    "Failed to launch the browser",
    "chrome_crashpad",
    "ran out of memory",
    "out of disk space",
  ];
  const isInfraError = infraErrors.some((pattern) =>
    lastError.includes(pattern),
  );
  if (isInfraError) {
    console.log(
      "[RenderErrorFixer] Infrastructure error detected, retrying render without code changes...",
    );
    return {
      currentStep: "rendering",
      lastRenderError: null,
      renderAttempts: state.renderAttempts + 1,
    };
  }

  // Try auto-fixing common errors first
  const { code: autoFixedCode, fixed } = autoFixCommonErrors(remotionCode);
  if (fixed) {
    console.log("[RenderErrorFixer] Auto-fixed common syntax errors");
    remotionCode = autoFixedCode;

    // Return immediately with fixed code to retry rendering
    return {
      remotionCode: autoFixedCode,
      currentStep: "rendering",
      lastRenderError: null,
    };
  }

  const prompt = `${RENDER_ERROR_FIXER_SYSTEM_PROMPT}

## RENDER ERROR TO FIX:
\`\`\`
${lastError}
\`\`\`

## CURRENT REMOTION CODE (with errors):
\`\`\`tsx
${remotionCode}
\`\`\`

## REQUIREMENTS:
1. Fix the specific error mentioned above
2. Ensure the code compiles and renders without errors
3. Keep all animations and visual design intact
4. Make minimal changes - only fix what's broken
5. Return the COMPLETE fixed code

Output the fixed Remotion code in a TypeScript code block.`;

  try {
    console.log("[RenderErrorFixer] Calling Gemini Flash to fix errors...");
    const response = await chatWithGeminiFlash(
      [{ role: "user", content: prompt }],
      {
        temperature: 0.2,
        maxTokens: 16000,
      },
    );

    // Extract code from response using RegExp constructor to avoid backtick issues
    const backtick = String.fromCharCode(96);
    const codeBlockPattern = new RegExp(
      backtick +
        backtick +
        backtick +
        "(?:tsx?|jsx?|javascript)?\\s*([\\s\\S]*?)" +
        backtick +
        backtick +
        backtick,
    );
    const codeMatch = response.content.match(codeBlockPattern);
    let fixedCode = codeMatch ? codeMatch[1].trim() : response.content;

    // Ensure there's a default export
    if (!fixedCode.includes("export default")) {
      if (
        fixedCode.includes("const VideoComposition") ||
        fixedCode.includes("function VideoComposition")
      ) {
        fixedCode += "\n\nexport default VideoComposition;";
      } else {
        const componentMatch = fixedCode.match(
          /(?:const|function)\s+([A-Z][a-zA-Z0-9]*)/,
        );
        if (componentMatch) {
          fixedCode += `\n\nexport default ${componentMatch[1]};`;
        }
      }
    }

    console.log(
      "[RenderErrorFixer] Generated fixed code:",
      fixedCode.length,
      "chars",
    );

    return {
      remotionCode: fixedCode,
      currentStep: "rendering", // Go back to rendering to test the fix
      lastRenderError: null,
    };
  } catch (error) {
    console.error("[RenderErrorFixer] Error:", error);
    return {
      errors: [ `Error fixing render: ${error}`],
      currentStep: "error",
    };
  }
}
