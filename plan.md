# Motion Graphic Video Generation Platform - Implementation Plan

## Overview

A platform that generates product videos from website URLs or descriptions using AI agents, Remotion for rendering, and Nanobanana for image generation.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Interface                               │
│  (URL input / Description input / Video preview / Export controls)  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Orchestration Layer                             │
│              (Next.js API Routes + State Management)                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│  Agent 1:     │       │  Agent 2:     │       │  Agent 3:     │
│  Web Scraper  │──────▶│  Script       │──────▶│  Remotion     │
│  (Puppeteer + │       │  Generator    │       │  Code Gen     │
│   Claude)     │       │  (Claude)     │       │  (Claude)     │
└───────────────┘       └───────────────┘       └───────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│  Product Data │       │  Video Script │       │  Remotion     │
│  (JSON)       │       │  (Structured) │       │  Components   │
└───────────────┘       └───────────────┘       └───────────────┘
                                                        │
                                  ┌─────────────────────┤
                                  ▼                     ▼
                        ┌───────────────┐       ┌───────────────┐
                        │  Nanobanana   │       │  Audio        │
                        │  Image Gen    │       │  Beat Analyzer│
                        └───────────────┘       └───────────────┘
                                  │                     │
                                  └──────────┬──────────┘
                                             ▼
                              ┌─────────────────────────┐
                              │  Remotion Player/Render │
                              │  (Browser-based)        │
                              └─────────────────────────┘
```

---

## Tech Stack

| Component               | Technology                                             |
| ----------------------- | ------------------------------------------------------ |
| Frontend                | Next.js 16 + React 19 + Tailwind CSS                   |
| Video Engine            | Remotion 4.x                                           |
| **Agent Orchestration** | **LangGraph.js**                                       |
| AI Agents               | Anthropic Claude API                                   |
| AI Skills               | Remotion Skills (`npx skills add remotion-dev/skills`) |
| Web Scraping            | Puppeteer / Playwright                                 |
| Image Generation        | Nanobanana (Google) - v2                               |
| Audio Analysis          | Web Audio API / Essentia.js                            |
| State Management        | Zustand                                                |
| Database                | PostgreSQL + Prisma (for saving projects)              |
| File Storage            | Local / S3 (for assets)                                |

---

## LangGraph Agent Orchestration

LangGraph.js will orchestrate the multi-agent pipeline with state management and conditional routing.

### Install LangGraph

```bash
npm install @langchain/langgraph @langchain/anthropic @langchain/core
```

### Graph Architecture

```
                    ┌─────────────┐
                    │   START     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Scraper    │ ◄── URL or Description
                    │   Node      │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Script     │ ◄── ProductData
                    │  Writer     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Code       │ ◄── VideoScript
                    │  Generator  │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    END      │ ──► Remotion Composition
                    └─────────────┘
```

### State Schema

```typescript
import { Annotation } from "@langchain/langgraph";

// Define the state that flows through the graph
const VideoGenerationState = Annotation.Root({
  // Input
  sourceUrl: Annotation<string | null>,
  description: Annotation<string | null>,
  userPreferences: Annotation<{
    style: "professional" | "playful" | "minimal" | "bold";
    musicUrl?: string;
    musicBpm?: number;
  }>,

  // Agent outputs
  productData: Annotation<ProductData | null>,
  videoScript: Annotation<VideoScript | null>,
  remotionCode: Annotation<string | null>,

  // Status
  currentStep: Annotation<"scraping" | "scripting" | "generating" | "complete">,
  errors: Annotation<string[]>,
});
```

### Graph Definition

```typescript
import { StateGraph } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  model: "claude-sonnet-4-20250514",
  temperature: 0.7,
});

// Define nodes
async function scraperNode(state: typeof VideoGenerationState.State) {
  // Scrape URL or process description
  const productData = await scrapeProduct(state.sourceUrl, state.description);
  return { productData, currentStep: "scripting" };
}

async function scriptWriterNode(state: typeof VideoGenerationState.State) {
  // Generate video script from product data
  const videoScript = await generateScript(state.productData, model);
  return { videoScript, currentStep: "generating" };
}

async function codeGeneratorNode(state: typeof VideoGenerationState.State) {
  // Generate Remotion code from script
  const remotionCode = await generateRemotionCode(state.videoScript, model);
  return { remotionCode, currentStep: "complete" };
}

// Build graph
const workflow = new StateGraph(VideoGenerationState)
  .addNode("scraper", scraperNode)
  .addNode("scriptWriter", scriptWriterNode)
  .addNode("codeGenerator", codeGeneratorNode)
  .addEdge("__start__", "scraper")
  .addEdge("scraper", "scriptWriter")
  .addEdge("scriptWriter", "codeGenerator")
  .addEdge("codeGenerator", "__end__");

// Compile and export
export const videoGenerationGraph = workflow.compile();
```

### Running the Graph

```typescript
// In API route: app/api/generate/route.ts
import { videoGenerationGraph } from "@/lib/agents/graph";

export async function POST(req: Request) {
  const { url, description, preferences } = await req.json();

  // Stream results for real-time UI updates
  const stream = await videoGenerationGraph.stream({
    sourceUrl: url,
    description,
    userPreferences: preferences,
    productData: null,
    videoScript: null,
    remotionCode: null,
    currentStep: "scraping",
    errors: [],
  });

  // Return streaming response
  return new Response(
    new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          controller.enqueue(JSON.stringify(chunk) + "\n");
        }
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}
```

### Error Handling & Retry

```typescript
// Add conditional edges for error handling
workflow.addConditionalEdges("scraper", (state) => {
  if (state.errors.length > 0) return "error_handler";
  return "scriptWriter";
});
```

---

## Remotion Skills Integration

Remotion provides official AI skills for code generation. Install via:

```bash
npx skills add remotion-dev/skills
```

### Skills Available (30+ rule files):

- **Animation Fundamentals** - interpolate(), spring(), timing
- **Text Animations** - typewriter, word-by-word, character stagger
- **Scene Transitions** - cuts, fades, wipes, zooms
- **Media Handling** - images, videos, audio, fonts, GIFs
- **3D Content** - Three.js / React Three Fiber integration
- **Data Visualization** - charts, graphs
- **Captions/Subtitles** - timing and styling
- **TailwindCSS** - styling integration

### Core Animation Patterns for Code Generator

**Interpolate Function** (for linear animations):

```tsx
import { useCurrentFrame, interpolate, AbsoluteFill } from "remotion";

export const FadeIn = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 60], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <div>Hello World!</div>
    </AbsoluteFill>
  );
};
```

**Spring Animation** (for bouncy/natural motion):

```tsx
import { useCurrentFrame, useVideoConfig, spring } from "remotion";

export const ScaleIn = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: {
      mass: 1,
      damping: 10,
      stiffness: 100,
    },
  });

  return <div style={{ transform: `scale(${scale})` }}>Hello World!</div>;
};
```

**Spring Config Options:**
| Parameter | Default | Purpose |
|-----------|---------|---------|
| `mass` | 1 | Lower = faster animation |
| `damping` | 10 | Higher = less bounce |
| `stiffness` | 100 | Higher = more bouncy |
| `overshootClamping` | false | Prevent overshooting |

**CRITICAL**: Never use CSS transitions in Remotion. All animations must be driven by `useCurrentFrame()` to avoid flickering during rendering.

---

## Phase 1: Project Setup & Core Infrastructure

### 1.1 Install Dependencies

```bash
# Remotion
npm install remotion @remotion/player @remotion/cli @remotion/transitions

# LangGraph + AI
npm install @langchain/langgraph @langchain/anthropic @langchain/core

# Web Scraping
npm install puppeteer

# Audio Analysis
npm install essentia.js

# State & Database
npm install zustand prisma @prisma/client

# Utilities
npm install zod uuid nanoid
```

### 1.2 Project Structure

```
/app
  /api
    /scrape           # Website scraping endpoint
    /generate-script  # Script generation endpoint
    /generate-code    # Remotion code generation endpoint
    /generate-image   # Nanobanana image generation
  /studio             # Video editor/preview page
  /projects           # Project management
  page.tsx            # Landing/input page

/components
  /ui                 # Shadcn-style UI components
  /video              # Video player, timeline components

/lib
  /agents
    graph.ts          # LangGraph workflow definition
    state.ts          # State schema for graph
    scraper.ts        # Web scraping agent node
    scriptWriter.ts   # Script generation agent node
    codeGenerator.ts  # Remotion code generator node
  /audio
    beatDetector.ts   # Beat detection utilities
  /remotion
    /templates        # Pre-built animation templates
    /compositions     # Generated compositions

/remotion
  Root.tsx            # Remotion entry
  /components         # Reusable animation components
    TextReveal.tsx
    ScrollAnimation.tsx
    ProductShowcase.tsx
    Transitions.tsx
```

---

## Phase 2: AI Agents Implementation

### 2.1 Agent 1: Web Scraper Agent

**Purpose:** Extract product information from URLs

**Input:**

```typescript
interface ScraperInput {
  url: string;
  additionalContext?: string;
}
```

**Process:**

1. Use Puppeteer to render the page (handle JS-rendered content)
2. Extract: title, descriptions, images, pricing, features, testimonials
3. Take screenshots of key sections
4. Send content + screenshots to Claude for structured extraction

**Output:**

```typescript
interface ProductData {
  name: string;
  tagline: string;
  description: string;
  features: Array<{ title: string; description: string; icon?: string }>;
  pricing?: Array<{ tier: string; price: string; features: string[] }>;
  testimonials?: Array<{ quote: string; author: string; role: string }>;
  images: string[]; // URLs
  colors: { primary: string; secondary: string; accent: string };
  tone: "professional" | "playful" | "minimal" | "bold";
}
```

### 2.2 Agent 2: Script Writer Agent

**Purpose:** Convert product data into a video script with timing

**Input:** ProductData + user preferences (duration, style, music tempo)

**Process:**

1. Analyze product data
2. Create narrative arc (hook → problem → solution → features → CTA)
3. Break into scenes with timing
4. Suggest visual treatments for each scene

**Output:**

```typescript
interface VideoScript {
  totalDuration: number; // in frames (30fps)
  scenes: Array<{
    id: string;
    startFrame: number;
    endFrame: number;
    type: "intro" | "feature" | "testimonial" | "cta" | "transition";
    content: {
      headline?: string;
      subtext?: string;
      image?: string; // URL or "generate:prompt"
    };
    animation: {
      enter: "fade" | "slide-up" | "scale" | "reveal" | "typewriter";
      exit: "fade" | "slide-down" | "scale-out";
    };
    style: {
      background: string;
      textColor: string;
      fontSize: "large" | "medium" | "small";
    };
  }>;
  transitions: Array<{
    afterScene: string;
    type: "cut" | "fade" | "wipe" | "zoom" | "beat-sync";
    duration: number;
  }>;
  music: {
    tempo: number; // BPM
    mood: string;
  };
}
```

### 2.3 Agent 3: Remotion Code Generator

**Purpose:** Convert VideoScript into executable Remotion code

**Input:** VideoScript + available templates + Remotion Skills context

**Process:**

1. Load Remotion skills documentation into context
2. Map scenes to Remotion components using `<Sequence>` for timing
3. Use `<TransitionSeries>` for scene transitions (from `@remotion/transitions`)
4. Apply animations using `interpolate()` and `spring()`
5. Integrate beat markers for beat-synced animations

**Sequence Pattern for Scene Composition:**

```tsx
import { Composition, Sequence, AbsoluteFill } from "remotion";

export const ProductVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Scene 1: Intro - frames 0-90 */}
      <Sequence from={0} durationInFrames={90}>
        <IntroScene />
      </Sequence>

      {/* Scene 2: Features - frames 90-240 */}
      <Sequence from={90} durationInFrames={150}>
        <FeaturesScene />
      </Sequence>

      {/* Scene 3: CTA - frames 240-300 */}
      <Sequence from={240} durationInFrames={60}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};
```

**TransitionSeries for Smooth Transitions:**

```tsx
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";

export const ProductVideo: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={90}>
        <IntroScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />

      <TransitionSeries.Sequence durationInFrames={150}>
        <FeaturesScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: 20 })}
      />

      <TransitionSeries.Sequence durationInFrames={60}>
        <CTAScene />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
```

**Output:**

```typescript
// Generated Remotion composition file
// Stored in /lib/remotion/generated/{projectId}.tsx
```

**Prompt Strategy for Code Generator:**
The Claude agent should receive:

1. The VideoScript JSON with all scenes and timings
2. Remotion skills documentation (fetched from remotion.dev/docs/\*.md)
3. Template components available in the project
4. Constraints: No CSS transitions, all animation via useCurrentFrame()

---

## Prompt Engineering Strategy

### Agent System Prompts

**Scraper Agent System Prompt:**

```
You are a product analyst specializing in extracting marketing information from websites.
Given a URL and its rendered content (HTML + screenshots), extract:
- Product name and tagline
- Key features and benefits
- Pricing information
- Social proof (testimonials, reviews, stats)
- Brand colors and visual style
- Target audience

Output as structured JSON matching the ProductData schema.
Focus on compelling marketing angles that would work well in a video.
```

**Script Writer Agent System Prompt:**

```
You are a video scriptwriter specializing in product marketing videos.
Given product data, create a video script with:
- Hook (0-3 seconds): Grab attention
- Problem (3-8 seconds): Relatable pain point
- Solution (8-15 seconds): Product introduction
- Features (15-35 seconds): 3-4 key benefits
- Social Proof (35-45 seconds): Trust signals
- CTA (45-60 seconds): Clear call to action

Output as structured JSON matching the VideoScript schema.
Include specific animation suggestions for each scene.
Consider the music tempo ({bpm} BPM) when timing transitions.
```

**Code Generator Agent System Prompt:**

```
You are a Remotion developer. Generate React/Remotion code for videos.

CRITICAL RULES:
1. NEVER use CSS transitions or @keyframes - causes flickering
2. ALL animations MUST use useCurrentFrame() + interpolate() or spring()
3. Use <Sequence> for scene timing
4. Use <TransitionSeries> from @remotion/transitions for transitions
5. Use AbsoluteFill for positioning
6. Clamp interpolate outputs with extrapolateRight: "clamp"

Given a VideoScript JSON, generate a complete Remotion composition.
Use the provided template components when available.
```

---

## Phase 3: Remotion Animation System

### 3.1 Core Animation Components

**TextReveal.tsx**

- Typewriter effect
- Word-by-word reveal
- Character stagger animation
- Glitch/scramble reveal

**ScrollAnimation.tsx**

- Vertical scroll effect
- Parallax layers
- Phone/browser mockup scrolling

**ProductShowcase.tsx**

- 3D rotation (CSS transforms)
- Zoom and pan
- Feature callouts with arrows

**Transitions.tsx**

- Beat-synced flash
- Wipe transitions
- Zoom transitions
- Morph transitions

### 3.2 Beat-Synced Animation System

```typescript
interface BeatMap {
  bpm: number;
  beats: number[]; // frame numbers where beats occur
  drops: number[]; // major transition points
}

// Usage in Remotion
const { frame } = useCurrentFrame();
const beatMap = useBeatMap(audioSrc);

// Trigger animation on beat
const isOnBeat = beatMap.beats.includes(frame);
const scale = isOnBeat
  ? spring({ frame, fps: 30, config: { damping: 10 } })
  : 1;
```

### 3.3 Pre-built Templates

1. **SaaS Product Launch** - Clean, professional, feature-focused
2. **App Showcase** - Phone mockups, scrolling, playful
3. **E-commerce Product** - Hero shots, pricing, urgency
4. **Agency/Service** - Testimonials, portfolio, trust signals

---

## Phase 4: Audio & Beat Detection

### 4.1 Beat Detection Pipeline

```typescript
// Using Web Audio API + Essentia.js
async function analyzeBeat(audioUrl: string): Promise<BeatMap> {
  const audioContext = new AudioContext();
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Use Essentia.js for beat tracking
  const essentia = new Essentia(EssentiaWASM);
  const beats = essentia.BeatTrackerMultiFeature(audioBuffer);

  return {
    bpm: beats.bpm,
    beats: beats.ticks.map((t) => Math.round(t * 30)), // Convert to frames
    drops: detectDrops(audioBuffer),
  };
}
```

### 4.2 Audio Library Integration

- Provide royalty-free music library (upbeat tracks)
- Allow user upload
- Auto-detect BPM and sync animations

---

## Phase 5: Asset Management (MVP)

### 5.1 Image Handling

For MVP, images will come from:

1. **Scraped images** - Extracted from the product website
2. **User uploads** - Allow users to upload custom images
3. **Stock library** - Integrate free stock photos (Unsplash API)

```typescript
interface ImageAsset {
  id: string;
  url: string;
  source: "scraped" | "uploaded" | "stock";
  prompt?: string; // For future AI generation
}
```

### 5.2 Future: Nanobanana Integration (v2)

- Image generation will be added once API access is available
- Script will support `"generate:prompt"` syntax for deferred implementation

---

## Phase 6: User Interface

### 6.1 Main Pages

**Landing Page (`/`)**

- URL input field
- "Or describe your product" text area
- Style preferences (template, duration, mood)
- "Generate Video" button

**Studio Page (`/studio/[projectId]`)**

- Left: Scene timeline with thumbnails
- Center: Remotion Player preview
- Right: Properties panel (edit text, colors, timing)
- Bottom: Audio waveform with beat markers
- Export button

### 6.2 Generation Flow UI

```
Step 1: Input URL/Description
         ↓
Step 2: "Analyzing website..." (show scraper progress)
         ↓
Step 3: "Generating script..." (show scene breakdown)
         ↓
Step 4: "Creating video..." (show Remotion preview)
         ↓
Step 5: Studio (edit & export)
```

---

## Phase 7: Data Models

### 7.1 Prisma Schema

```prisma
model Project {
  id          String   @id @default(cuid())
  userId      String?
  sourceUrl   String?
  description String?
  productData Json     // ProductData
  script      Json     // VideoScript
  composition String   // Generated Remotion code
  audioUrl    String?
  status      Status   @default(DRAFT)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum Status {
  DRAFT
  GENERATING
  READY
  EXPORTED
}
```

---

## Implementation Order

### Week 1: Foundation

- [ ] Set up Remotion in Next.js project
- [ ] Create basic animation components (TextReveal, Transitions)
- [ ] Build Remotion Player preview page
- [ ] Set up Anthropic Claude API integration

### Week 2: AI Agents

- [ ] Implement web scraper agent (Puppeteer + Claude)
- [ ] Implement script writer agent
- [ ] Implement Remotion code generator agent
- [ ] Create agent orchestration flow

### Week 3: Animation System

- [ ] Build all core animation components
- [ ] Create 2-3 video templates
- [ ] Implement beat detection system
- [ ] Add beat-synced animation triggers

### Week 4: UI & Polish

- [ ] Build full studio UI with Remotion Player
- [ ] Add project save/load (Prisma)
- [ ] MP4 export functionality
- [ ] Music library integration (royalty-free tracks)

### Week 5: Testing & Refinement

- [ ] End-to-end testing
- [ ] Prompt engineering refinement
- [ ] Performance optimization
- [ ] User testing

---

## Key Files to Create

| File                          | Purpose                                          |
| ----------------------------- | ------------------------------------------------ |
| `lib/agents/graph.ts`         | **LangGraph workflow definition**                |
| `lib/agents/state.ts`         | **State schema for LangGraph**                   |
| `lib/agents/scraper.ts`       | Scraper agent node                               |
| `lib/agents/scriptWriter.ts`  | Script writer agent node                         |
| `lib/agents/codeGenerator.ts` | Code generator agent node                        |
| `app/api/generate/route.ts`   | **Main generation endpoint (streams LangGraph)** |
| `app/studio/[id]/page.tsx`    | Video editor page                                |
| `lib/audio/beatDetector.ts`   | Beat detection                                   |
| `remotion/Root.tsx`           | Remotion entry point                             |
| `remotion/components/*.tsx`   | Animation components                             |

---

## Verification Plan

1. **Unit Test Agents**: Mock inputs, verify output structure
2. **Integration Test**: URL → Video pipeline end-to-end
3. **Visual Test**: Compare generated videos against expected output
4. **Performance Test**: Generation time < 60 seconds for typical video

---

## Decisions Made

| Question         | Decision                                                          |
| ---------------- | ----------------------------------------------------------------- |
| Video duration   | **Auto-detect** - AI determines optimal duration based on content |
| Export format    | **MP4 only** - Most compatible format                             |
| Image generation | **Skip for now** - Focus on core features, add Nanobanana later   |
| Music            | **Both options** - Curated royalty-free library + user upload     |

---

## Simplified MVP Scope

For the initial version, we'll focus on:

1. URL scraping → Script generation → Remotion code generation
2. Pre-built animation components and templates
3. Browser-based rendering with Remotion Player
4. MP4 export
5. Music library + user upload with beat detection

**Deferred to v2:**

- Nanobanana image generation
- VPS/Lambda rendering
- Advanced 3D animations
