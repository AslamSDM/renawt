import { z } from "zod";
import { BUILTIN_COMPONENTS, type ComponentMeta } from "./registry";

function describeZodField(schema: z.ZodTypeAny): string {
  const def: any = (schema as any)._def;
  const typeName = def?.typeName as string | undefined;

  if (typeName === "ZodDefault") {
    const inner = describeZodField(def.innerType);
    const dflt = def.defaultValue();
    return `${inner} (default: ${JSON.stringify(dflt)})`;
  }
  if (typeName === "ZodOptional") return `${describeZodField(def.innerType)} (optional)`;
  if (typeName === "ZodNullable") return `${describeZodField(def.innerType)} | null`;
  if (typeName === "ZodString") return "string";
  if (typeName === "ZodNumber") return "number";
  if (typeName === "ZodBoolean") return "boolean";
  if (typeName === "ZodEnum") return `enum: ${(def.values as string[]).join(" | ")}`;
  if (typeName === "ZodArray") return `array<${describeZodField(def.type)}>`;
  if (typeName === "ZodObject") return "object";
  return typeName ?? "unknown";
}

function describeProps(meta: ComponentMeta): string {
  const shape = meta.propsSchema.shape as Record<string, z.ZodTypeAny>;
  const lines: string[] = [];
  for (const [key, value] of Object.entries(shape)) {
    lines.push(`    - ${key}: ${describeZodField(value)}`);
  }
  return lines.join("\n");
}

function describeComponent(meta: ComponentMeta): string {
  return [
    `### ${meta.name}  [category: ${meta.category}]`,
    meta.description,
    `Use cases: ${meta.useCases.join(", ")}`,
    `Props:`,
    describeProps(meta),
    `Example: ${JSON.stringify(meta.example)}`,
  ].join("\n");
}

export function buildRegistryPrompt(): string {
  const sections = Object.values(BUILTIN_COMPONENTS).map(describeComponent);
  return [
    "## AVAILABLE COMPONENTS",
    "Reference any of these by exact name in scene `layers[].component`. Provide `props` matching the listed shape.",
    "",
    sections.join("\n\n"),
  ].join("\n");
}

export const CUSTOM_COMPONENT_GUIDE = `## CREATING CUSTOM COMPONENTS
If no built-in component fits, you may define a new one in \`customComponents\`.

Each entry: { name: PascalCase, description?, source: "function Name(props) { return <...>; }" }

In scope inside \`source\` (no imports needed):
- React (JSX)
- AbsoluteFill, Sequence, Audio, Video — Remotion containers
- useCurrentFrame(), useVideoConfig() — Remotion hooks
- interpolate, spring, staticFile — Remotion utilities
- All built-in components from the registry (referenceable as JSX tags)
- applyAnim(animation, localFrame, fps) helper for entrance animations

Rules:
- Function declaration only, no \`import\` / \`export\` / arrow assignment.
- Pure render — no fetch, no setTimeout, no mutation outside state.
- Keep props serializable (string, number, boolean, array, object).
- Reference custom components in scenes by their \`name\`.

Example:
{
  "name": "PriceTag",
  "source": "function PriceTag({ price, currency = '$' }) { const frame = useCurrentFrame(); return <AbsoluteFill style={{alignItems:'center',justifyContent:'center'}}><div style={{color:'#fff',fontSize:120,fontWeight:900}}>{currency}{price}</div></AbsoluteFill>; }"
}`;
