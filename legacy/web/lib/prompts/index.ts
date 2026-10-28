/**
 * Example Prompts for Video Generation
 * These prompts showcase different animation capabilities
 */

export const examplePrompts = [
  {
    id: "text-typewriter",
    headline: "Typewriter text",
    icon: "Type",
    prompt: `Generate the text "Hello world" with world in yellow highlighting. Black text, white background. That words should be shown next to each other in the center of the screen.

Animation: Let the words fade in from left to right and then highlight "world" yellow. Mimic a typewriter effect for the text appearance with a blinking cursor at the end of the text.`,
    color: "#fdba74",
  },
  {
    id: "chat-bubbles",
    headline: "Chat messages",
    icon: "MessageCircle",
    prompt: `WhatsApp-style chat bubbles that appear one by one with a bouncy spring animation, alternating between sent and received messages.
Use green for sent messages and gray for received messages. Position them on left and right sides respectively.`,
    color: "#86efac",
  },
  {
    id: "counter",
    headline: "Metric counters",
    icon: "Hash",
    prompt: `Three animated number counters showing Users (10,000), Revenue ($50,000), and Growth (127%) that count up from zero with staggered timing.

Show all metrics at the same time, use this color #fde047. Focus on no overlaps and no flickering. Show the metrics in the center.`,
    color: "#fde047",
  },
  {
    id: "bar-chart",
    headline: "Bar chart",
    icon: "BarChart3",
    prompt: `An animated histogram with the gold price for the following data:
{
  "title": "Gold Price 2024",
  "unit": "USD per troy ounce",
  "data": [
    { "month": "Jan", "price": 2039 },
    { "month": "Feb", "price": 2024 },
    { "month": "Mar", "price": 2160 },
    { "month": "Apr", "price": 2330 },
    { "month": "May", "price": 2327 },
    { "month": "Jun", "price": 2339 },
    { "month": "Jul", "price": 2426 },
    { "month": "Aug", "price": 2503 },
    { "month": "Sep", "price": 2634 },
    { "month": "Oct", "price": 2735 },
    { "month": "Nov", "price": 2672 },
    { "month": "Dec", "price": 2650 }
  ]
}`,
    color: "#a5b4fc",
  },
  {
    id: "doge-dvd",
    headline: "Doge screensaver",
    icon: "Disc",
    prompt: `Create a DVD-Rom Style animation of this image https://i.pinimg.com/600x/ac/82/57/ac8257e1cfc4e63f5c63f3d4869eb7c4.jpg
The graphic moves smoothly across the screen in a straight line, bouncing off the edges of the screen whenever it hits a border. Each time it hits a corner or side, it changes direction, creating a continuous floating, ricocheting motion. The speed is steady, the movement is linear, and the object keeps rotating around the screen endlessly, just like the classic DVD logo screensaver.

Change the color on every bounce, no rotation, Make the animation speed fast.`,
    color: "#f9a8d4",
  },
  {
    id: "3d-cube",
    headline: "3D Rotating Cube",
    icon: "Box",
    prompt: `Create a 3D scene with a rotating cube using ThreeCanvas from @remotion/three.

The cube should:
- Rotate continuously on all three axes
- Have a gradient material from blue to purple
- Include proper lighting (ambient + directional)
- Have a dark background
- Use spring animation for a smooth entrance scale from 0 to 1
- Float slightly up and down using a sine wave

Make sure to include ThreeCanvas wrapper and proper lights.`,
    color: "#60a5fa",
  },
  {
    id: "product-showcase",
    headline: "Product Showcase",
    icon: "Smartphone",
    prompt: `Create a tech product showcase video with:

1. A phone mockup in the center
2. The product name "Nexus Pro" appearing with kinetic text animation
3. Three feature cards that slide in from the right with staggered timing
4. A gradient background that shifts colors subtly
5. Use spring physics for all entrance animations

Style: Modern, sleek, tech-focused with purple and cyan accent colors.`,
    color: "#c084fc",
  },
  {
    id: "social-media-story",
    headline: "Instagram Story",
    icon: "Instagram",
    prompt: `Create a vertical Instagram story format (9:16) with:

1. A bold headline "50% OFF SALE" that bounces in
2. Subtext "Limited time only" that fades in below
3. A countdown timer showing remaining time
4. A swipe-up arrow animation at the bottom
5. Use vibrant gradient background (pink to orange)

Keep text large and readable for mobile viewing.`,
    color: "#f472b6",
  },
] as const;

export type ExamplePrompt = (typeof examplePrompts)[number];

/**
 * System prompts for AI generation
 */
export const SYSTEM_PROMPTS = {
  codeGeneration: `
You are an expert in generating React components for Remotion animations.

## COMPONENT STRUCTURE

1. Start with ES6 imports
2. Export as: export const MyAnimation = () => { ... };
3. Component body order:
   - Multi-line comment description (2-3 sentences)
   - Hooks (useCurrentFrame, useVideoConfig, etc.)
   - Constants (COLORS, TEXT, TIMING, LAYOUT) - all UPPER_SNAKE_CASE
   - Calculations and derived values
   - return JSX

## CONSTANTS RULES (CRITICAL)

ALL constants MUST be defined INSIDE the component body, AFTER hooks:
- Colors: const COLOR_TEXT = "#000000";
- Text: const TITLE_TEXT = "Hello World";
- Timing: const FADE_DURATION = 20;
- Layout: const PADDING = 40;

This allows users to easily customize the animation.

## LAYOUT RULES

- Use full width of container with appropriate padding
- Never constrain content to a small centered box
- Use responsive sizing with percentages

## ANIMATION RULES

- Prefer spring() for organic motion (entrances, bounces, scaling)
- Use interpolate() for linear progress (progress bars, opacity fades)
- Always use { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
- Add stagger delays for multiple elements

## AVAILABLE IMPORTS

- useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, spring, Sequence from "remotion"
- TransitionSeries, linearTiming, springTiming from "@remotion/transitions"
- fade, slide, wipe from "@remotion/transitions"
- Circle, Rect, Triangle, Star, Ellipse, Pie from "@remotion/shapes"
- ThreeCanvas from "@remotion/three"

## STYLING RULES

- Use inline styles only
- ALWAYS use fontFamily: 'Inter, sans-serif'
- Keep colors minimal (2-4 max)
- ALWAYS set backgroundColor on AbsoluteFill from frame 0

## OUTPUT FORMAT

- Output ONLY code - no explanations, no questions
- Response must start with "import" and end with "};"
`,

  validation: `
You are a prompt classifier for a motion graphics generation tool.

Determine if the user's prompt is asking for motion graphics/animation content that can be created as a React/Remotion component.

VALID prompts include requests for:
- Animated text, titles, or typography
- Data visualizations (charts, graphs, progress bars)
- UI animations (buttons, cards, transitions)
- Logo animations or brand intros
- Social media content (stories, reels, posts)
- Explainer animations
- Kinetic typography
- Abstract motion graphics
- Animated illustrations
- Product showcases
- Countdown timers
- Loading animations
- Any visual/animated content

INVALID prompts include:
- Questions (e.g., "What is 2+2?", "How do I...")
- Requests for text/written content (poems, essays, stories, code explanations)
- Conversations or chat
- Non-visual tasks (calculations, translations, summaries)
- Requests completely unrelated to visual content

Return true if the prompt is valid for motion graphics generation, false otherwise.
`,
};

/**
 * Get prompts by category
 */
export function getPromptsByCategory(category: string): ExamplePrompt[] {
  const categoryMap: Record<string, string[]> = {
    text: ["text-typewriter"],
    messaging: ["chat-bubbles"],
    data: ["bar-chart", "counter"],
    fun: ["doge-dvd"],
    "3d": ["3d-cube"],
    product: ["product-showcase"],
    social: ["social-media-story"],
  };

  const ids = categoryMap[category] || [];
  return examplePrompts.filter((p) => ids.includes(p.id));
}
