/**
 * 3D component primitives for cinematic videos.
 *
 * All sources reference scope-level identifiers from codegen.REMOTION_IMPORTS:
 *   - ThreeCanvas (from @remotion/three)
 *   - useFrame, useThree (from @react-three/fiber)
 *   - THREE (from three)
 *   - Standard Remotion helpers (useCurrentFrame, useVideoConfig, interpolate,
 *     spring, AbsoluteFill, Img)
 */

import { z } from "zod";
import type { ComponentMeta } from "./registry";

export const REGISTRY_3D: Record<string, ComponentMeta> = {
  ThreeProductHero: {
    name: "ThreeProductHero",
    category: "media",
    description:
      "3D plane displaying an image (typically the site's hero screenshot) with a subtle camera orbit + soft lighting. Cinematic product reveal.",
    useCases: [
      "intro hero with the actual website screenshot",
      "premium product showcase",
      "feature shot with depth",
    ],
    propsSchema: z.object({
      src: z.string().describe("Image URL — typically heroScreenshot"),
      bgColor: z.string().default("#0a0a0a"),
      orbit: z.number().default(0.15).describe("Orbit amplitude in radians"),
      tilt: z.number().default(0.05),
    }),
    example: { src: "https://example.com/hero.png", bgColor: "#000", orbit: 0.18 },
    source: `
function ThreeProductHero({ src, bgColor = "#0a0a0a", orbit = 0.15, tilt = 0.05 }) {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: bgColor }}>
      <ThreeCanvas width={width} height={height}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 5]} intensity={1.1} />
        <ProductHeroPlane src={src} orbit={orbit} tilt={tilt} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
}
function ProductHeroPlane({ src, orbit, tilt }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ref = React.useRef();
  const tex = React.useMemo(() => {
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    return loader.load(src);
  }, [src]);
  useFrame(() => {
    if (!ref.current) return;
    const t = frame / fps;
    ref.current.rotation.y = Math.sin(t * 0.4) * orbit;
    ref.current.rotation.x = tilt + Math.cos(t * 0.3) * 0.02;
    ref.current.position.z = -0.3 + Math.sin(t * 0.5) * 0.1;
  });
  return (
    <mesh ref={ref}>
      <planeGeometry args={[3.2, 1.8]} />
      <meshStandardMaterial map={tex} roughness={0.4} metalness={0.1} />
    </mesh>
  );
}`,
  },

  GlassPanel3D: {
    name: "GlassPanel3D",
    category: "card",
    description:
      "Frosted-glass card floating in 3D with subtle parallax. Use over an image or gradient bg.",
    useCases: ["feature card on glass site", "stat callout", "testimonial bezel"],
    propsSchema: z.object({
      title: z.string(),
      body: z.string().default(""),
      tint: z.string().default("rgba(255,255,255,0.08)"),
      borderColor: z.string().default("rgba(255,255,255,0.16)"),
      blur: z.number().default(20),
      depth: z.number().default(0.4),
      x: z.union([z.string(), z.number()]).default("50%"),
      y: z.union([z.string(), z.number()]).default("50%"),
      width: z.union([z.string(), z.number()]).default(640),
      delay: z.number().default(0),
    }),
    example: { title: "Built for speed", body: "M5 chip + 18-hour battery" },
    source: `
function GlassPanel3D({ title, body = "", tint = "rgba(255,255,255,0.08)", borderColor = "rgba(255,255,255,0.16)", blur = 20, depth = 0.4, x = "50%", y = "50%", width = 640, delay = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const opacity = interpolate(local, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const enter = spring({ frame: local, fps, config: { damping: 14, stiffness: 100 } });
  const float = Math.sin((frame / fps) * 1.4) * 4 * depth;
  return (
    <div style={{
      position: "absolute", left: x, top: y, width,
      transform: \`translate(-50%, calc(-50% + \${float}px)) scale(\${0.92 + enter * 0.08})\`,
      padding: "32px 40px", borderRadius: 24,
      background: tint, backdropFilter: \`blur(\${blur}px)\`, WebkitBackdropFilter: \`blur(\${blur}px)\`,
      border: \`1px solid \${borderColor}\`, opacity,
      boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
    }}>
      <div style={{ fontSize: 36, fontWeight: 700, color: "#fff", marginBottom: body ? 12 : 0 }}>{title}</div>
      {body ? <div style={{ fontSize: 20, fontWeight: 400, color: "rgba(255,255,255,0.78)", lineHeight: 1.4 }}>{body}</div> : null}
    </div>
  );
}`,
  },

  DepthParallax: {
    name: "DepthParallax",
    category: "background",
    description:
      "Three-layer parallax background — back/mid/front move at different speeds. Pass src URLs or solid colors.",
    useCases: ["depth scene", "scrolling parallax", "cinematic background"],
    propsSchema: z.object({
      back: z.string().default("#0b1020"),
      mid: z.string().default("#1a2540"),
      front: z.string().default("#2a3a60"),
      direction: z.enum(["up", "down", "left", "right"]).default("up"),
      speed: z.number().default(0.5),
    }),
    example: { back: "#0b1020", mid: "#1a2540", front: "#2a3a60", direction: "up" },
    source: `
function DepthParallax({ back = "#0b1020", mid = "#1a2540", front = "#2a3a60", direction = "up", speed = 0.5 }) {
  const frame = useCurrentFrame();
  const move = frame * speed;
  const axis = direction === "left" || direction === "right" ? "X" : "Y";
  const sign = direction === "right" || direction === "down" ? 1 : -1;
  const layer = (col, depth) => {
    const isImage = typeof col === "string" && col.startsWith("http");
    const style = {
      position: "absolute", inset: 0,
      transform: \`translate\${axis}(\${sign * move * depth}px) scale(\${1 + depth * 0.05})\`,
      background: isImage ? \`url(\${col}) center/cover no-repeat\` : col,
      filter: depth < 0.5 ? \`blur(\${(0.5 - depth) * 18}px)\` : "none",
    };
    return <div style={style} />;
  };
  return (
    <AbsoluteFill>
      {layer(back, 0.2)}
      {layer(mid, 0.5)}
      {layer(front, 0.9)}
    </AbsoluteFill>
  );
}`,
  },

  CameraPan3D: {
    name: "CameraPan3D",
    category: "background",
    description:
      "Slow camera pan over a 3D scene of textured panels — adds cinematic motion to static content.",
    useCases: ["cinematic establishing shot", "feature montage", "outro slow zoom"],
    propsSchema: z.object({
      panels: z
        .array(z.object({ src: z.string().optional(), color: z.string().optional() }))
        .min(1)
        .default([{ color: "#1e293b" }]),
      bgColor: z.string().default("#000"),
      duration: z.number().default(150),
    }),
    example: {
      panels: [{ color: "#1e293b" }, { color: "#3b0764" }, { color: "#0c4a6e" }],
      bgColor: "#000",
    },
    source: `
function CameraPan3D({ panels = [{ color: "#1e293b" }], bgColor = "#000", duration = 150 }) {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: bgColor }}>
      <ThreeCanvas width={width} height={height}>
        <ambientLight intensity={0.5} />
        <pointLight position={[5, 5, 5]} intensity={1.2} />
        <PanRig panels={panels} duration={duration} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
}
function PanRig({ panels, duration }) {
  const frame = useCurrentFrame();
  const { camera } = useThree();
  const t = Math.min(1, frame / duration);
  const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  React.useEffect(() => {
    camera.fov = 45;
    camera.updateProjectionMatrix();
  }, [camera]);
  useFrame(() => {
    camera.position.x = -2.5 + eased * 5;
    camera.position.z = 4;
    camera.lookAt(0, 0, 0);
  });
  return (
    <>
      {panels.map((p, i) => {
        const tex = p.src ? new THREE.TextureLoader().load(p.src) : null;
        return (
          <mesh key={i} position={[(i - (panels.length - 1) / 2) * 2.4, 0, -i * 0.3]} rotation={[0, -0.15, 0]}>
            <planeGeometry args={[2.0, 1.2]} />
            <meshStandardMaterial color={p.color || "#222"} map={tex || undefined} roughness={0.5} metalness={0.2} />
          </mesh>
        );
      })}
    </>
  );
}`,
  },

  MaterialCard: {
    name: "MaterialCard",
    category: "card",
    description:
      "Card with PBR-style material — metallic / glossy / matte. Renders flat 2D card with material-aware highlights.",
    useCases: ["premium feature card", "product spec callout", "stat card on metallic site"],
    propsSchema: z.object({
      title: z.string(),
      body: z.string().default(""),
      material: z.enum(["matte", "glossy", "metallic", "neon"]).default("metallic"),
      accent: z.string().default("#ffffff"),
      x: z.union([z.string(), z.number()]).default("50%"),
      y: z.union([z.string(), z.number()]).default("50%"),
      width: z.union([z.string(), z.number()]).default(560),
      delay: z.number().default(0),
    }),
    example: { title: "M5 Chip", body: "40% faster cores", material: "metallic" },
    source: `
function MaterialCard({ title, body = "", material = "metallic", accent = "#ffffff", x = "50%", y = "50%", width = 560, delay = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const enter = spring({ frame: local, fps, config: { damping: 16, stiffness: 120 } });
  const opacity = interpolate(local, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const styles = {
    matte:    { bg: "#1a1a1a", color: "#fff", border: "rgba(255,255,255,0.08)", shine: "none" },
    glossy:   { bg: "linear-gradient(135deg, #1f2937 0%, #0f172a 50%, #1f2937 100%)", color: "#fff", border: "rgba(255,255,255,0.18)", shine: \`linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)\` },
    metallic: { bg: "linear-gradient(160deg, #d1d5db 0%, #6b7280 50%, #1f2937 100%)", color: "#0a0a0a", border: "rgba(255,255,255,0.5)", shine: \`linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)\` },
    neon:     { bg: "#06010a", color: "#fff", border: accent, shine: \`radial-gradient(circle at 30% 20%, \${accent}55, transparent 50%)\` },
  }[material];
  return (
    <div style={{
      position: "absolute", left: x, top: y, width,
      transform: \`translate(-50%, -50%) scale(\${0.94 + enter * 0.06})\`,
      opacity, padding: "28px 36px", borderRadius: 20,
      background: styles.bg, color: styles.color,
      border: \`1px solid \${styles.border}\`,
      boxShadow: material === "neon" ? \`0 0 40px \${accent}55, inset 0 0 30px \${accent}22\` : "0 24px 48px rgba(0,0,0,0.4)",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, background: styles.shine, pointerEvents: "none" }} />
      <div style={{ fontSize: 32, fontWeight: 700, marginBottom: body ? 10 : 0, position: "relative" }}>{title}</div>
      {body ? <div style={{ fontSize: 18, opacity: 0.82, position: "relative" }}>{body}</div> : null}
    </div>
  );
}`,
  },

  ParticleField: {
    name: "ParticleField",
    category: "background",
    description:
      "Drifting particle bg — dust, snow, sparks. Animates per frame, supports color + density.",
    useCases: ["cinematic backdrop", "neon scene base", "subtle ambient layer"],
    propsSchema: z.object({
      color: z.string().default("#ffffff"),
      bgColor: z.string().default("#05060a"),
      count: z.number().int().min(20).max(400).default(120),
      speed: z.number().default(0.4),
      size: z.number().default(2),
    }),
    example: { color: "#a5f3fc", bgColor: "#020617", count: 150 },
    source: `
function ParticleField({ color = "#ffffff", bgColor = "#05060a", count = 120, speed = 0.4, size = 2 }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const particles = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z: 0.3 + Math.random() * 0.7,
        s: 0.4 + Math.random() * 1.6,
      });
    }
    return arr;
  }, [count, width, height]);
  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      {particles.map((p, i) => {
        const drift = (frame * speed * p.z * 4) % (height + 50);
        const y = (p.y + drift) % (height + 50) - 25;
        const op = 0.15 + p.z * 0.6;
        return (
          <div key={i} style={{
            position: "absolute", left: p.x, top: y,
            width: size * p.s, height: size * p.s,
            borderRadius: "50%", backgroundColor: color,
            opacity: op, filter: \`blur(\${(1 - p.z) * 1.4}px)\`,
            boxShadow: \`0 0 \${size * p.s * 3}px \${color}\`,
          }} />
        );
      })}
    </AbsoluteFill>
  );
}`,
  },
};
