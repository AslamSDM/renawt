import { z } from "zod";

export interface ComponentMeta {
  name: string;
  category: "background" | "text" | "media" | "card" | "shape";
  description: string;
  useCases: string[];
  propsSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  example: Record<string, unknown>;
  /**
   * TSX source — function declaration only, no imports.
   * In scope at codegen time: React, AbsoluteFill, Sequence, Audio, Video,
   * useCurrentFrame, useVideoConfig, interpolate, spring, staticFile.
   */
  source: string;
}

const animationEnum = z.enum([
  "none",
  "fade",
  "slide-up",
  "slide-down",
  "scale",
  "blur-in",
]);

const easeInOut = `function ease(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }`;

const animateSource = `
${easeInOut}
function applyAnim(animation, localFrame, fps) {
  if (animation === "none") return { opacity: 1, transform: "none", filter: "none" };
  const dur = Math.max(1, Math.round(fps * 0.5));
  const t = Math.min(1, Math.max(0, localFrame / dur));
  const e = ease(t);
  if (animation === "fade") return { opacity: e, transform: "none", filter: "none" };
  if (animation === "slide-up") return { opacity: e, transform: \`translateY(\${(1-e)*40}px)\`, filter: "none" };
  if (animation === "slide-down") return { opacity: e, transform: \`translateY(\${(1-e)*-40}px)\`, filter: "none" };
  if (animation === "scale") {
    const s = spring({ frame: localFrame, fps, config: { damping: 14 } });
    return { opacity: e, transform: \`scale(\${s})\`, filter: "none" };
  }
  if (animation === "blur-in") return { opacity: e, transform: "none", filter: \`blur(\${(1-e)*16}px)\` };
  return { opacity: 1, transform: "none", filter: "none" };
}`;

export const SHARED_HELPERS = animateSource;

export const BUILTIN_COMPONENTS: Record<string, ComponentMeta> = {
  GradientBg: {
    name: "GradientBg",
    category: "background",
    description: "Full-frame linear gradient background.",
    useCases: ["intro background", "section divider", "CTA backdrop"],
    propsSchema: z.object({
      from: z.string().default("#0f172a"),
      to: z.string().default("#1e293b"),
      angle: z.number().default(135),
    }),
    example: { from: "#0f172a", to: "#7c3aed", angle: 135 },
    source: `
function GradientBg({ from = "#0f172a", to = "#1e293b", angle = 135 }) {
  return <AbsoluteFill style={{ background: \`linear-gradient(\${angle}deg, \${from}, \${to})\` }} />;
}`,
  },

  SolidBg: {
    name: "SolidBg",
    category: "background",
    description: "Solid color full-frame background.",
    useCases: ["minimal scenes", "neutral backdrop"],
    propsSchema: z.object({ color: z.string().default("#000000") }),
    example: { color: "#000000" },
    source: `
function SolidBg({ color = "#000000" }) {
  return <AbsoluteFill style={{ backgroundColor: color }} />;
}`,
  },

  ImageBg: {
    name: "ImageBg",
    category: "background",
    description: "Full-frame image background with optional overlay tint.",
    useCases: ["product hero", "screenshot backdrop"],
    propsSchema: z.object({
      src: z.string(),
      fit: z.enum(["cover", "contain"]).default("cover"),
      overlayColor: z.string().default("rgba(0,0,0,0.35)"),
    }),
    example: { src: "https://...", fit: "cover", overlayColor: "rgba(0,0,0,0.4)" },
    source: `
function ImageBg({ src, fit = "cover", overlayColor = "rgba(0,0,0,0.35)" }) {
  return (
    <AbsoluteFill>
      <img src={src} style={{ width: "100%", height: "100%", objectFit: fit }} />
      <AbsoluteFill style={{ backgroundColor: overlayColor }} />
    </AbsoluteFill>
  );
}`,
  },

  Title: {
    name: "Title",
    category: "text",
    description: "Large animated headline. Centered by default.",
    useCases: ["intro headline", "section title", "punchline"],
    propsSchema: z.object({
      text: z.string(),
      color: z.string().default("#ffffff"),
      size: z.number().default(96),
      weight: z.number().default(800),
      font: z.string().default("Inter, sans-serif"),
      animation: animationEnum.default("slide-up"),
      delay: z.number().default(0),
      align: z.enum(["left", "center", "right"]).default("center"),
      x: z.string().default("50%"),
      y: z.string().default("50%"),
      maxWidth: z.string().default("80%"),
    }),
    example: { text: "Ship faster", animation: "slide-up", delay: 5 },
    source: `
function Title({ text, color = "#fff", size = 96, weight = 800, font = "Inter, sans-serif", animation = "slide-up", delay = 0, align = "center", x = "50%", y = "50%", maxWidth = "80%" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);
  const a = applyAnim(animation, localFrame, fps);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{
        position: "absolute", left: x, top: y, transform: \`translate(-50%, -50%) \${a.transform}\`,
        color, fontSize: size, fontWeight: weight, fontFamily: font, textAlign: align,
        opacity: a.opacity, filter: a.filter, maxWidth, lineHeight: 1.05,
      }}>{text}</div>
    </AbsoluteFill>
  );
}`,
  },

  Subtitle: {
    name: "Subtitle",
    category: "text",
    description: "Secondary text under a title.",
    useCases: ["tagline", "supporting copy"],
    propsSchema: z.object({
      text: z.string(),
      color: z.string().default("rgba(255,255,255,0.75)"),
      size: z.number().default(36),
      weight: z.number().default(500),
      font: z.string().default("Inter, sans-serif"),
      animation: animationEnum.default("fade"),
      delay: z.number().default(8),
      x: z.string().default("50%"),
      y: z.string().default("60%"),
      maxWidth: z.string().default("70%"),
    }),
    example: { text: "Built for makers", delay: 12 },
    source: `
function Subtitle({ text, color = "rgba(255,255,255,0.75)", size = 36, weight = 500, font = "Inter, sans-serif", animation = "fade", delay = 8, x = "50%", y = "60%", maxWidth = "70%" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);
  const a = applyAnim(animation, localFrame, fps);
  return (
    <AbsoluteFill>
      <div style={{
        position: "absolute", left: x, top: y, transform: \`translate(-50%, -50%) \${a.transform}\`,
        color, fontSize: size, fontWeight: weight, fontFamily: font, textAlign: "center",
        opacity: a.opacity, filter: a.filter, maxWidth, lineHeight: 1.3,
      }}>{text}</div>
    </AbsoluteFill>
  );
}`,
  },

  BulletList: {
    name: "BulletList",
    category: "text",
    description: "Vertical staggered list of bullets.",
    useCases: ["feature list", "key benefits"],
    propsSchema: z.object({
      items: z.array(z.string()),
      color: z.string().default("#ffffff"),
      bulletColor: z.string().default("#a78bfa"),
      size: z.number().default(40),
      gap: z.number().default(20),
      x: z.string().default("12%"),
      y: z.string().default("50%"),
      stagger: z.number().default(8),
      delay: z.number().default(0),
    }),
    example: { items: ["Fast", "Reliable", "Simple"] },
    source: `
function BulletList({ items, color = "#fff", bulletColor = "#a78bfa", size = 40, gap = 20, x = "12%", y = "50%", stagger = 8, delay = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap }}>
        {items.map((it, i) => {
          const local = Math.max(0, frame - delay - i * stagger);
          const a = applyAnim("slide-up", local, fps);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, color, fontSize: size, fontFamily: "Inter, sans-serif", opacity: a.opacity, transform: a.transform }}>
              <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", backgroundColor: bulletColor }} />
              <span>{it}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}`,
  },

  FeatureCard: {
    name: "FeatureCard",
    category: "card",
    description: "Glass card with icon, title, description.",
    useCases: ["feature highlight", "benefit callout"],
    propsSchema: z.object({
      title: z.string(),
      description: z.string(),
      icon: z.string().default("✨"),
      accentColor: z.string().default("#a78bfa"),
      x: z.string().default("50%"),
      y: z.string().default("50%"),
      width: z.number().default(640),
      delay: z.number().default(0),
    }),
    example: { title: "Realtime sync", description: "Edits propagate instantly.", icon: "⚡" },
    source: `
function FeatureCard({ title, description, icon = "✨", accentColor = "#a78bfa", x = "50%", y = "50%", width = 640, delay = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);
  const a = applyAnim("scale", localFrame, fps);
  return (
    <AbsoluteFill>
      <div style={{
        position: "absolute", left: x, top: y, transform: \`translate(-50%, -50%) \${a.transform}\`,
        width, padding: 36, borderRadius: 24,
        background: "rgba(255,255,255,0.06)", border: \`1px solid \${accentColor}40\`,
        backdropFilter: "blur(20px)", color: "#fff", fontFamily: "Inter, sans-serif",
        opacity: a.opacity,
      }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{icon}</div>
        <div style={{ fontSize: 40, fontWeight: 700, marginBottom: 12 }}>{title}</div>
        <div style={{ fontSize: 24, color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>{description}</div>
      </div>
    </AbsoluteFill>
  );
}`,
  },

  CTABanner: {
    name: "CTABanner",
    category: "card",
    description: "Centered CTA with headline + button-styled text.",
    useCases: ["closing scene", "call to action"],
    propsSchema: z.object({
      headline: z.string(),
      buttonText: z.string().default("Get started"),
      url: z.string().optional(),
      accentColor: z.string().default("#7c3aed"),
      delay: z.number().default(0),
    }),
    example: { headline: "Try it free today", buttonText: "Sign up" },
    source: `
function CTABanner({ headline, buttonText = "Get started", url, accentColor = "#7c3aed", delay = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);
  const aH = applyAnim("slide-up", localFrame, fps);
  const aB = applyAnim("scale", Math.max(0, localFrame - 10), fps);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 36 }}>
      <div style={{ color: "#fff", fontSize: 88, fontWeight: 800, fontFamily: "Inter, sans-serif", textAlign: "center", maxWidth: "80%", opacity: aH.opacity, transform: aH.transform }}>{headline}</div>
      <div style={{ padding: "20px 48px", borderRadius: 999, backgroundColor: accentColor, color: "#fff", fontSize: 32, fontWeight: 700, fontFamily: "Inter, sans-serif", opacity: aB.opacity, transform: aB.transform }}>{buttonText}{url ? \`  →\` : ""}</div>
    </AbsoluteFill>
  );
}`,
  },

  RecordingClip: {
    name: "RecordingClip",
    category: "media",
    description: "Plays a screen recording clip with optional mockup frame.",
    useCases: ["product demo", "feature walkthrough"],
    propsSchema: z.object({
      src: z.string(),
      trimStart: z.number().default(0),
      mockup: z.enum(["none", "browser", "macbook"]).default("none"),
      x: z.string().default("50%"),
      y: z.string().default("50%"),
      width: z.number().default(1600),
      height: z.number().default(900),
    }),
    example: { src: "https://...", mockup: "browser" },
    source: `
function RecordingClip({ src, trimStart = 0, mockup = "none", x = "50%", y = "50%", width = 1600, height = 900 }) {
  const padding = mockup === "browser" ? 40 : mockup === "macbook" ? 30 : 0;
  const chrome = mockup === "browser"
    ? <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 36, background: "#1f2937", borderRadius: "16px 16px 0 0", display: "flex", alignItems: "center", padding: "0 16px", gap: 8 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: ["#ef4444","#f59e0b","#10b981"][i] }} />)}
      </div>
    : null;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", width, height, borderRadius: 16, overflow: "hidden", backgroundColor: "#000", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>
        {chrome}
        <div style={{ position: "absolute", inset: padding, top: mockup === "browser" ? 36 + padding : padding, overflow: "hidden", borderRadius: 8 }}>
          <Video src={src} startFrom={trimStart} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
}`,
  },

  Logo: {
    name: "Logo",
    category: "media",
    description: "Brand logo (image) with entrance animation.",
    useCases: ["intro brand reveal", "outro brand mark"],
    propsSchema: z.object({
      src: z.string(),
      width: z.number().default(280),
      animation: animationEnum.default("scale"),
      delay: z.number().default(0),
      x: z.string().default("50%"),
      y: z.string().default("50%"),
    }),
    example: { src: "https://logo.png", animation: "scale" },
    source: `
function Logo({ src, width = 280, animation = "scale", delay = 0, x = "50%", y = "50%" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);
  const a = applyAnim(animation, localFrame, fps);
  return (
    <AbsoluteFill>
      <img src={src} style={{ position: "absolute", left: x, top: y, transform: \`translate(-50%, -50%) \${a.transform}\`, width, opacity: a.opacity, filter: a.filter }} />
    </AbsoluteFill>
  );
}`,
  },

  Box: {
    name: "Box",
    category: "shape",
    description: "Generic rectangular div for layout/decoration. Composable primitive.",
    useCases: ["accent shape", "color block", "container"],
    propsSchema: z.object({
      x: z.string().default("0"),
      y: z.string().default("0"),
      width: z.string().default("100px"),
      height: z.string().default("100px"),
      color: z.string().default("#7c3aed"),
      borderRadius: z.number().default(0),
      opacity: z.number().min(0).max(1).default(1),
      animation: animationEnum.default("none"),
      delay: z.number().default(0),
    }),
    example: { x: "10%", y: "10%", width: "200px", height: "200px", color: "#7c3aed" },
    source: `
function Box({ x = "0", y = "0", width = "100px", height = "100px", color = "#7c3aed", borderRadius = 0, opacity = 1, animation = "none", delay = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);
  const a = applyAnim(animation, localFrame, fps);
  return (
    <div style={{ position: "absolute", left: x, top: y, width, height, backgroundColor: color, borderRadius, opacity: a.opacity * opacity, transform: a.transform, filter: a.filter }} />
  );
}`,
  },

  AnimatedGradient: {
    name: "AnimatedGradient",
    category: "background",
    description: "Background with a gradient that slowly shifts angle over time.",
    useCases: ["dynamic intro", "cinematic backdrop", "energy-rich scene"],
    propsSchema: z.object({
      colors: z.array(z.string()).default(["#0f172a", "#7c3aed", "#06b6d4"]),
      speed: z.number().default(0.5),
    }),
    example: { colors: ["#000", "#7c3aed", "#06b6d4"], speed: 0.6 },
    source: `
function AnimatedGradient({ colors = ["#0f172a", "#7c3aed", "#06b6d4"], speed = 0.5 }) {
  const frame = useCurrentFrame();
  const angle = (frame * speed) % 360;
  return <AbsoluteFill style={{ background: \`linear-gradient(\${angle}deg, \${colors.join(", ")})\` }} />;
}`,
  },

  GridBg: {
    name: "GridBg",
    category: "background",
    description: "Subtle grid pattern over a solid background.",
    useCases: ["tech aesthetic", "developer tools", "data products"],
    propsSchema: z.object({
      bgColor: z.string().default("#0a0a0f"),
      lineColor: z.string().default("rgba(255,255,255,0.08)"),
      cellSize: z.number().default(80),
    }),
    example: { bgColor: "#0a0a0f", cellSize: 60 },
    source: `
function GridBg({ bgColor = "#0a0a0f", lineColor = "rgba(255,255,255,0.08)", cellSize = 80 }) {
  return <AbsoluteFill style={{ backgroundColor: bgColor, backgroundImage: \`linear-gradient(\${lineColor} 1px, transparent 1px), linear-gradient(90deg, \${lineColor} 1px, transparent 1px)\`, backgroundSize: \`\${cellSize}px \${cellSize}px\` }} />;
}`,
  },

  RadialGradientBg: {
    name: "RadialGradientBg",
    category: "background",
    description: "Radial gradient (spotlight from a point).",
    useCases: ["focal scene", "highlight backdrop"],
    propsSchema: z.object({
      from: z.string().default("#7c3aed"),
      to: z.string().default("#000000"),
      x: z.string().default("50%"),
      y: z.string().default("50%"),
    }),
    example: { from: "#7c3aed", to: "#000", x: "50%", y: "30%" },
    source: `
function RadialGradientBg({ from = "#7c3aed", to = "#000", x = "50%", y = "50%" }) {
  return <AbsoluteFill style={{ background: \`radial-gradient(circle at \${x} \${y}, \${from}, \${to})\` }} />;
}`,
  },

  TypewriterText: {
    name: "TypewriterText",
    category: "text",
    description: "Text typed in character by character.",
    useCases: ["code feel", "command-line aesthetic", "dramatic reveal"],
    propsSchema: z.object({
      text: z.string(),
      color: z.string().default("#ffffff"),
      size: z.number().default(64),
      font: z.string().default("ui-monospace, monospace"),
      cps: z.number().default(20),
      delay: z.number().default(0),
      x: z.string().default("50%"),
      y: z.string().default("50%"),
      cursor: z.boolean().default(true),
    }),
    example: { text: "$ ship --fast", cps: 25, font: "ui-monospace, monospace" },
    source: `
function TypewriterText({ text, color = "#fff", size = 64, font = "ui-monospace, monospace", cps = 20, delay = 0, x = "50%", y = "50%", cursor = true }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const charsShown = Math.min(text.length, Math.floor((local / fps) * cps));
  const blink = Math.floor(local / (fps / 2)) % 2 === 0;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", color, fontSize: size, fontFamily: font, whiteSpace: "pre", textAlign: "center" }}>
        {text.slice(0, charsShown)}{cursor && <span style={{ opacity: blink ? 1 : 0 }}>▌</span>}
      </div>
    </AbsoluteFill>
  );
}`,
  },

  GradientText: {
    name: "GradientText",
    category: "text",
    description: "Headline filled with a linear gradient.",
    useCases: ["hero text", "premium feel", "brand emphasis"],
    propsSchema: z.object({
      text: z.string(),
      from: z.string().default("#a78bfa"),
      to: z.string().default("#06b6d4"),
      angle: z.number().default(135),
      size: z.number().default(120),
      weight: z.number().default(900),
      font: z.string().default("Inter, sans-serif"),
      animation: animationEnum.default("slide-up"),
      delay: z.number().default(0),
      x: z.string().default("50%"),
      y: z.string().default("50%"),
    }),
    example: { text: "The future", from: "#a78bfa", to: "#06b6d4" },
    source: `
function GradientText({ text, from = "#a78bfa", to = "#06b6d4", angle = 135, size = 120, weight = 900, font = "Inter, sans-serif", animation = "slide-up", delay = 0, x = "50%", y = "50%" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim(animation, local, fps);
  return (
    <AbsoluteFill>
      <div style={{
        position: "absolute", left: x, top: y, transform: \`translate(-50%, -50%) \${a.transform}\`,
        fontSize: size, fontWeight: weight, fontFamily: font, lineHeight: 1.05,
        backgroundImage: \`linear-gradient(\${angle}deg, \${from}, \${to})\`,
        WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
        opacity: a.opacity, filter: a.filter, textAlign: "center",
      }}>{text}</div>
    </AbsoluteFill>
  );
}`,
  },

  WordStagger: {
    name: "WordStagger",
    category: "text",
    description: "Words appear sequentially with a slide-up.",
    useCases: ["punchy copy", "rhythmic reveal"],
    propsSchema: z.object({
      text: z.string(),
      color: z.string().default("#ffffff"),
      size: z.number().default(80),
      weight: z.number().default(700),
      font: z.string().default("Inter, sans-serif"),
      stagger: z.number().default(6),
      delay: z.number().default(0),
      x: z.string().default("50%"),
      y: z.string().default("50%"),
    }),
    example: { text: "Build. Ship. Repeat.", stagger: 10 },
    source: `
function WordStagger({ text, color = "#fff", size = 80, weight = 700, font = "Inter, sans-serif", stagger = 6, delay = 0, x = "50%", y = "50%" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", maxWidth: "85%" }}>
        {words.map((w, i) => {
          const local = Math.max(0, frame - delay - i * stagger);
          const a = applyAnim("slide-up", local, fps);
          return <span key={i} style={{ color, fontSize: size, fontWeight: weight, fontFamily: font, opacity: a.opacity, transform: a.transform, lineHeight: 1.1 }}>{w}</span>;
        })}
      </div>
    </AbsoluteFill>
  );
}`,
  },

  NumberCounter: {
    name: "NumberCounter",
    category: "text",
    description: "Animated number counting up to a target.",
    useCases: ["stats reveal", "metric highlight", "growth claim"],
    propsSchema: z.object({
      target: z.number(),
      prefix: z.string().default(""),
      suffix: z.string().default(""),
      decimals: z.number().int().min(0).max(4).default(0),
      durationFrames: z.number().default(45),
      color: z.string().default("#ffffff"),
      size: z.number().default(160),
      weight: z.number().default(900),
      font: z.string().default("Inter, sans-serif"),
      x: z.string().default("50%"),
      y: z.string().default("50%"),
      delay: z.number().default(0),
    }),
    example: { target: 10000, prefix: "$", suffix: "+", durationFrames: 60 },
    source: `
function NumberCounter({ target, prefix = "", suffix = "", decimals = 0, durationFrames = 45, color = "#fff", size = 160, weight = 900, font = "Inter, sans-serif", x = "50%", y = "50%", delay = 0 }) {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - delay);
  const t = Math.min(1, local / durationFrames);
  const eased = 1 - Math.pow(1 - t, 3);
  const value = (eased * target).toFixed(decimals);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", color, fontSize: size, fontWeight: weight, fontFamily: font, fontVariantNumeric: "tabular-nums" }}>
        {prefix}{value}{suffix}
      </div>
    </AbsoluteFill>
  );
}`,
  },

  Quote: {
    name: "Quote",
    category: "text",
    description: "Large pull-quote with quotation marks.",
    useCases: ["testimonial scene", "notable claim"],
    propsSchema: z.object({
      text: z.string(),
      attribution: z.string().optional(),
      color: z.string().default("#ffffff"),
      size: z.number().default(56),
      font: z.string().default("Georgia, serif"),
      delay: z.number().default(0),
    }),
    example: { text: "Cut our build time by 80%.", attribution: "Anna, CTO at Acme" },
    source: `
function Quote({ text, attribution, color = "#fff", size = 56, font = "Georgia, serif", delay = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim("fade", local, fps);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", padding: "0 10%" }}>
      <div style={{ color, fontSize: size, fontFamily: font, fontStyle: "italic", textAlign: "center", lineHeight: 1.3, opacity: a.opacity, transform: a.transform }}>
        <span style={{ fontSize: size * 1.5, opacity: 0.4 }}>“</span>{text}<span style={{ fontSize: size * 1.5, opacity: 0.4 }}>”</span>
      </div>
      {attribution && <div style={{ marginTop: 32, color: "rgba(255,255,255,0.6)", fontSize: 28, fontFamily: "Inter, sans-serif", opacity: a.opacity }}>— {attribution}</div>}
    </AbsoluteFill>
  );
}`,
  },

  TestimonialCard: {
    name: "TestimonialCard",
    category: "card",
    description: "Card with quote, author name, role/company, optional avatar.",
    useCases: ["social proof", "customer voice"],
    propsSchema: z.object({
      quote: z.string(),
      author: z.string(),
      role: z.string().optional(),
      avatarUrl: z.string().optional(),
      accentColor: z.string().default("#a78bfa"),
      delay: z.number().default(0),
      width: z.number().default(820),
    }),
    example: { quote: "Game-changer.", author: "Jamie Park", role: "PM at Linear" },
    source: `
function TestimonialCard({ quote, author, role, avatarUrl, accentColor = "#a78bfa", delay = 0, width = 820 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim("scale", local, fps);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width, padding: 48, borderRadius: 24, background: "rgba(255,255,255,0.06)", border: \`1px solid \${accentColor}40\`, backdropFilter: "blur(20px)", color: "#fff", fontFamily: "Inter, sans-serif", opacity: a.opacity, transform: a.transform }}>
        <div style={{ fontSize: 32, lineHeight: 1.4, marginBottom: 32 }}>"{quote}"</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {avatarUrl && <img src={avatarUrl} style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} />}
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{author}</div>
            {role && <div style={{ fontSize: 18, color: "rgba(255,255,255,0.6)" }}>{role}</div>}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}`,
  },

  StatCard: {
    name: "StatCard",
    category: "card",
    description: "Large number + label, optionally with delta indicator.",
    useCases: ["KPI scene", "growth chart placeholder"],
    propsSchema: z.object({
      value: z.string(),
      label: z.string(),
      delta: z.string().optional(),
      deltaPositive: z.boolean().default(true),
      accentColor: z.string().default("#10b981"),
      delay: z.number().default(0),
      x: z.string().default("50%"),
      y: z.string().default("50%"),
    }),
    example: { value: "10x", label: "Faster builds", delta: "+220%" },
    source: `
function StatCard({ value, label, delta, deltaPositive = true, accentColor = "#10b981", delay = 0, x = "50%", y = "50%" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim("slide-up", local, fps);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: \`translate(-50%, -50%) \${a.transform}\`, textAlign: "center", color: "#fff", fontFamily: "Inter, sans-serif", opacity: a.opacity }}>
        <div style={{ fontSize: 200, fontWeight: 900, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 32, color: "rgba(255,255,255,0.7)", marginTop: 16 }}>{label}</div>
        {delta && <div style={{ display: "inline-block", marginTop: 24, padding: "8px 20px", borderRadius: 999, backgroundColor: \`\${deltaPositive ? accentColor : "#ef4444"}30\`, color: deltaPositive ? accentColor : "#ef4444", fontSize: 22, fontWeight: 700 }}>{delta}</div>}
      </div>
    </AbsoluteFill>
  );
}`,
  },

  PhoneMockup: {
    name: "PhoneMockup",
    category: "media",
    description: "Phone bezel framing an image or video URL.",
    useCases: ["mobile app demo", "responsive showcase"],
    propsSchema: z.object({
      src: z.string(),
      kind: z.enum(["image", "video"]).default("image"),
      x: z.string().default("50%"),
      y: z.string().default("50%"),
      height: z.number().default(900),
      delay: z.number().default(0),
    }),
    example: { src: "https://...", kind: "video", height: 900 },
    source: `
function PhoneMockup({ src, kind = "image", x = "50%", y = "50%", height = 900, delay = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim("slide-up", local, fps);
  const w = height * 0.5;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: \`translate(-50%, -50%) \${a.transform}\`, width: w, height, backgroundColor: "#000", borderRadius: 60, padding: 16, boxShadow: "0 30px 80px rgba(0,0,0,0.6)", border: "2px solid #2a2a2a", opacity: a.opacity }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 44, overflow: "hidden", position: "relative", backgroundColor: "#111" }}>
          <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", width: 100, height: 28, backgroundColor: "#000", borderRadius: 999, zIndex: 2 }} />
          {kind === "video" ? <Video src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        </div>
      </div>
    </AbsoluteFill>
  );
}`,
  },

  BrowserMockup: {
    name: "BrowserMockup",
    category: "media",
    description: "Browser window chrome around an image/video.",
    useCases: ["webapp screenshot reveal", "landing page showcase"],
    propsSchema: z.object({
      src: z.string(),
      kind: z.enum(["image", "video"]).default("image"),
      url: z.string().default("yoursite.com"),
      x: z.string().default("50%"),
      y: z.string().default("50%"),
      width: z.number().default(1500),
      delay: z.number().default(0),
    }),
    example: { src: "https://...", url: "acme.com", width: 1500 },
    source: `
function BrowserMockup({ src, kind = "image", url = "yoursite.com", x = "50%", y = "50%", width = 1500, delay = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim("scale", local, fps);
  const h = width * 0.6;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: \`translate(-50%, -50%) \${a.transform}\`, width, height: h + 44, borderRadius: 12, overflow: "hidden", backgroundColor: "#1f2937", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", opacity: a.opacity }}>
        <div style={{ height: 44, display: "flex", alignItems: "center", padding: "0 16px", gap: 8 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: ["#ef4444","#f59e0b","#10b981"][i] }} />)}
          <div style={{ marginLeft: 16, padding: "6px 16px", borderRadius: 8, backgroundColor: "#111827", color: "#9ca3af", fontSize: 14, fontFamily: "ui-monospace, monospace" }}>{url}</div>
        </div>
        <div style={{ width: "100%", height: h, backgroundColor: "#000" }}>
          {kind === "video" ? <Video src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        </div>
      </div>
    </AbsoluteFill>
  );
}`,
  },

  ProgressBar: {
    name: "ProgressBar",
    category: "shape",
    description: "Animated progress bar that fills over time.",
    useCases: ["loading visual", "metric viz", "skill bar"],
    propsSchema: z.object({
      target: z.number().min(0).max(1).default(1),
      durationFrames: z.number().default(60),
      color: z.string().default("#7c3aed"),
      bgColor: z.string().default("rgba(255,255,255,0.1)"),
      label: z.string().optional(),
      x: z.string().default("50%"),
      y: z.string().default("50%"),
      width: z.number().default(800),
      height: z.number().default(20),
      delay: z.number().default(0),
    }),
    example: { target: 0.85, label: "Faster", durationFrames: 90 },
    source: `
function ProgressBar({ target = 1, durationFrames = 60, color = "#7c3aed", bgColor = "rgba(255,255,255,0.1)", label, x = "50%", y = "50%", width = 800, height = 20, delay = 0 }) {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - delay);
  const t = Math.min(1, local / durationFrames);
  const eased = 1 - Math.pow(1 - t, 3);
  const fill = eased * target;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", width, color: "#fff", fontFamily: "Inter, sans-serif" }}>
        {label && <div style={{ fontSize: 24, marginBottom: 12, display: "flex", justifyContent: "space-between" }}><span>{label}</span><span>{Math.round(fill * 100)}%</span></div>}
        <div style={{ width: "100%", height, backgroundColor: bgColor, borderRadius: height / 2, overflow: "hidden" }}>
          <div style={{ width: \`\${fill * 100}%\`, height: "100%", backgroundColor: color, borderRadius: height / 2 }} />
        </div>
      </div>
    </AbsoluteFill>
  );
}`,
  },

  IconLabel: {
    name: "IconLabel",
    category: "card",
    description: "Single icon with label below — placed at any position.",
    useCases: ["small feature callout", "feature grid item"],
    propsSchema: z.object({
      icon: z.string().default("✨"),
      label: z.string(),
      color: z.string().default("#ffffff"),
      iconSize: z.number().default(72),
      labelSize: z.number().default(24),
      x: z.string().default("50%"),
      y: z.string().default("50%"),
      delay: z.number().default(0),
    }),
    example: { icon: "⚡", label: "Fast" },
    source: `
function IconLabel({ icon = "✨", label, color = "#fff", iconSize = 72, labelSize = 24, x = "50%", y = "50%", delay = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim("scale", local, fps);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: \`translate(-50%, -50%) \${a.transform}\`, textAlign: "center", color, fontFamily: "Inter, sans-serif", opacity: a.opacity }}>
      <div style={{ fontSize: iconSize, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: labelSize, fontWeight: 600 }}>{label}</div>
    </div>
  );
}`,
  },

  NotificationToast: {
    name: "NotificationToast",
    category: "card",
    description: "Mac/iOS-style notification card sliding in from the corner.",
    useCases: ["product alert demo", "social notif scene"],
    propsSchema: z.object({
      title: z.string(),
      message: z.string(),
      icon: z.string().default("🔔"),
      x: z.string().default("70%"),
      y: z.string().default("15%"),
      width: z.number().default(440),
      delay: z.number().default(0),
    }),
    example: { title: "New message", message: "Anna shared a doc with you", icon: "💬" },
    source: `
function NotificationToast({ title, message, icon = "🔔", x = "70%", y = "15%", width = 440, delay = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim("slide-down", local, fps);
  return (
    <div style={{ position: "absolute", left: x, top: y, width, padding: 20, borderRadius: 18, backgroundColor: "rgba(40,40,50,0.85)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontFamily: "Inter, sans-serif", display: "flex", gap: 16, alignItems: "flex-start", opacity: a.opacity, transform: a.transform, boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
      <div style={{ fontSize: 36 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", lineHeight: 1.3 }}>{message}</div>
      </div>
    </div>
  );
}`,
  },

  CodeBlock: {
    name: "CodeBlock",
    category: "card",
    description: "Monospace code block with terminal/editor styling.",
    useCases: ["dev-tool demos", "API showcase"],
    propsSchema: z.object({
      code: z.string(),
      language: z.string().default("ts"),
      x: z.string().default("50%"),
      y: z.string().default("50%"),
      width: z.number().default(1100),
      fontSize: z.number().default(28),
      delay: z.number().default(0),
    }),
    example: { code: "const ship = () => fast()", language: "ts" },
    source: `
function CodeBlock({ code, language = "ts", x = "50%", y = "50%", width = 1100, fontSize = 28, delay = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim("scale", local, fps);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: \`translate(-50%, -50%) \${a.transform}\`, width, borderRadius: 16, overflow: "hidden", backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", opacity: a.opacity }}>
        <div style={{ padding: "10px 16px", backgroundColor: "#161b22", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#7d8590", fontSize: 14, fontFamily: "ui-monospace, monospace" }}>{language}</div>
        <pre style={{ margin: 0, padding: 24, color: "#e6edf3", fontSize, fontFamily: "ui-monospace, monospace", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{code}</pre>
      </div>
    </AbsoluteFill>
  );
}`,
  },

  Spotlight: {
    name: "Spotlight",
    category: "shape",
    description: "Soft radial vignette / spotlight overlay.",
    useCases: ["focus emphasis", "moody overlay"],
    propsSchema: z.object({
      color: z.string().default("rgba(0,0,0,0.85)"),
      x: z.string().default("50%"),
      y: z.string().default("50%"),
      radius: z.string().default("40%"),
    }),
    example: { x: "50%", y: "40%", radius: "30%" },
    source: `
function Spotlight({ color = "rgba(0,0,0,0.85)", x = "50%", y = "50%", radius = "40%" }) {
  return <AbsoluteFill style={{ background: \`radial-gradient(circle at \${x} \${y}, transparent 0, transparent \${radius}, \${color} 100%)\` }} />;
}`,
  },

  Circle: {
    name: "Circle",
    category: "shape",
    description: "Plain circle with optional pulse animation.",
    useCases: ["accent shape", "highlighted point", "decorative blob"],
    propsSchema: z.object({
      x: z.string().default("50%"),
      y: z.string().default("50%"),
      size: z.number().default(200),
      color: z.string().default("#7c3aed"),
      opacity: z.number().min(0).max(1).default(1),
      pulse: z.boolean().default(false),
      animation: animationEnum.default("none"),
      delay: z.number().default(0),
    }),
    example: { x: "20%", y: "30%", size: 300, color: "#a78bfa", pulse: true },
    source: `
function Circle({ x = "50%", y = "50%", size = 200, color = "#7c3aed", opacity = 1, pulse = false, animation = "none", delay = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim(animation, local, fps);
  const pulseScale = pulse ? 1 + 0.06 * Math.sin((local / fps) * Math.PI * 2) : 1;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: \`translate(-50%, -50%) scale(\${pulseScale}) \${a.transform}\`, width: size, height: size, borderRadius: "50%", backgroundColor: color, opacity: a.opacity * opacity, filter: a.filter }} />
  );
}`,
  },

  Divider: {
    name: "Divider",
    category: "shape",
    description: "Horizontal line, optionally animated drawing in.",
    useCases: ["section break", "underline accent"],
    propsSchema: z.object({
      x: z.string().default("50%"),
      y: z.string().default("50%"),
      width: z.number().default(400),
      thickness: z.number().default(2),
      color: z.string().default("#ffffff"),
      animateIn: z.boolean().default(true),
      durationFrames: z.number().default(20),
      delay: z.number().default(0),
    }),
    example: { width: 600, color: "#a78bfa", animateIn: true },
    source: `
function Divider({ x = "50%", y = "50%", width = 400, thickness = 2, color = "#fff", animateIn = true, durationFrames = 20, delay = 0 }) {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - delay);
  const t = animateIn ? Math.min(1, local / durationFrames) : 1;
  const eased = 1 - Math.pow(1 - t, 3);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", width, height: thickness, backgroundColor: color, transformOrigin: "left center", scale: \`\${eased} 1\` }} />
  );
}`,
  },
};

export type RegistryName = keyof typeof BUILTIN_COMPONENTS;
