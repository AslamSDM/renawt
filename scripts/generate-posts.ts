import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";

const POSTS_DIR = path.join(process.cwd(), "posts");
const TOTAL_POSTS = 100;
const BATCH_SIZE = 5; // generate 5 at a time to avoid rate limits

// Remawt context for the AI
const PRODUCT_CONTEXT = `
Remawt is an AI-powered video generator built for SaaS companies.
It turns a product URL or description into a studio-quality demo video in under 5 minutes.

Key facts:
- Built on Remotion (React-based video rendering), not templates
- Beat-synced animations — motion snaps to music rhythm automatically
- 5 visual styles: Dark Cinematic, Vibrant Brand, Editorial Clean, Neon Glow, Custom
- AI agent pipeline: scriptWriter, creativeDirector, brandAnalyzer, codeGenerator
- Screen recording support with auto-zoom detection and cursor tracking
- 15 curated, licensed music tracks (110-135 BPM)
- 4K export, MP4/WebM
- Credit-based pricing (Starter, Professional, Enterprise up to 10k+ videos/month)
- Effects: blur-in, scale-bounce, typewriter, glitch, wave, particles, spring physics, glassmorphism, aurora gradients
- 3D scene support via Three.js
- Brand color extraction from product URL
- Tech stack: Next.js 16, React 19, Remotion 4, Gemini 2.0 Flash, Three.js, Framer Motion, Prisma, Cloudflare R2
- Generates 10-15 scenes per video, ~45-60 seconds
`;

// Topic/angle seeds to ensure variety
const POST_ANGLES = [
  "personal story about struggling with video production before building remawt",
  "hot take: most SaaS demo videos are unwatchable — here's why",
  "breakdown of what happens behind the scenes when you paste a URL into remawt",
  "the real cost of NOT having a product demo video (with rough math)",
  "why beat-synced animations feel so much more professional — the psychology",
  "a lesson learned the hard way while building remawt",
  "comparing agency vs freelancer vs DIY vs remawt — honest pros and cons",
  "the landing page conversion data that convinced us video is non-negotiable",
  "why we chose Remotion over every other video framework",
  "how screen recordings go from boring to cinematic with AI post-processing",
  "product hunt launch advice — the demo video can make or break it",
  "unpopular opinion about AI-generated content in marketing",
  "the no-code revolution reaching video — what it means for founders",
  "why 4K rendering matters even when nobody consciously notices",
  "a specific customer use case or scenario where remawt saved the day",
  "the technical challenge of syncing animations to music beats",
  "why motion graphics beat live action for SaaS product marketing",
  "the script is the hardest part of any video — here's how AI handles it",
  "brand consistency in video — most tools ignore it, we obsess over it",
  "video SEO is a massively underrated channel for B2B",
  "the attention span crisis and what it means for video structure",
  "founders: your time is your scarcest resource — stop learning After Effects",
  "A/B testing product videos is now practical when generation takes 5 minutes",
  "conference season prep — your booth needs a loop video",
  "personalized video at scale — the future of ABM",
  "spring physics in animation — why linear easing looks robotic",
  "the CTA in your video matters more than you think",
  "enterprise video production at 10,000 videos/month",
  "how glassmorphism and aurora effects became the visual language of modern SaaS",
  "the 10-15 scene sweet spot and why it works",
  "video across the full marketing funnel — top, middle, bottom, post-sale",
  "investor decks need a 30-second product demo — here's why",
  "the typewriter text effect and why Apple uses it in every keynote",
  "sales emails with video get 3x the response rate",
  "your competitor has a demo video and you don't — that's a problem",
  "building in public reflection — lessons from the journey so far",
  "the music licensing minefield and how we solved it",
  "why we use Cloudflare R2 for media storage (zero egress fees)",
  "programmatic video generation is the next frontier after no-code",
  "your onboarding flow needs a video walkthrough — here's the data",
  "showing > telling: why raw product footage beats stock footage every time",
  "the feature card — an underrated UI pattern in product videos",
  "5 visual styles, zero design skills required — how remawt themes work",
  "video content creates a flywheel: one video, six use cases",
  "remawt isn't another Canva — here's why video-first matters",
  "the ROI math on video marketing for B2B SaaS",
  "AI can't replace film crews. but for product demos? it's already better.",
  "how brand color matching works under the hood",
  "quick story about a demo that almost didn't happen",
  "what I'd tell my past self about video marketing",
  "the 3 biggest mistakes in SaaS product videos",
  "your product changes every sprint — your marketing video should keep up",
  "why we built an AI agent pipeline instead of one monolithic model",
  "loom is great for internal comms. terrible for marketing. here's the gap.",
  "social algorithms love video — the engagement numbers are wild",
  "the difference between a demo video and an explainer video",
  "credit-based pricing: pay for what you use, not a monthly seat",
  "3D scenes in product videos — yes, really, with Three.js",
  "how gemini 2.0 flash gives us sub-second script generation",
  "the parallax depth effect and why it makes videos feel premium",
  "video makes your product feel real, finished, and trustworthy",
  "content marketing in 2026: video isn't optional anymore",
  "from idea to 4K export — the full remawt workflow in 5 steps",
  "animation effects that actually matter vs ones that are just noise",
  "the founder's guide to creating a product video in 5 minutes",
  "why every Y Combinator demo day pitch needs a video clip",
  "honest reflection on what AI video can and can't do today",
  "the problem with template-based video tools — every video looks the same",
  "how we render 4K video server-side with Remotion + Puppeteer",
  "marketing teams are drowning in content requests. video is the bottleneck.",
  "the real reason most startups skip video (it's not cost, it's intimidation)",
  "react components as video frames — the Remotion paradigm shift",
  "making video as iteratable as copy — generate, test, learn, repeat",
  "a breakdown of the perfect 48-second SaaS demo structure",
  "dark mode cinematic style — why it converts so well for developer tools",
  "the exponential decay curve that makes beat sync feel natural",
  "your landing page hero section needs movement, not a static image",
  "how remawt's creative director agent picks the right visual style",
  "the overlooked power of background music in product perception",
  "stop overthinking your product video. ship it.",
  "why framer motion on the web and remotion in video are the perfect pair",
  "the zoom-and-pan technique that makes screen recordings watchable",
  "b2b buyers watch an average of 13 videos before making a purchase decision",
  "how we went from 0 to rendering thousands of videos",
  "the simple truth: pages with video convert 2x better",
  "quick rant about generic stock footage in B2B marketing",
  "particle effects, aurora gradients, and the aesthetics of modern SaaS",
  "your product video should feel like your product — not like a template",
  "the surprising thing about BPM ranges and viewer engagement",
  "enterprise teams need volume. remawt was built for volume.",
  "a short story about the first time someone used remawt and their reaction",
  "why I'm bullish on programmatic video replacing manual editing",
  "the cursor tracking feature nobody asked for but everyone loves",
  "text animation isn't decoration — it's a reading comprehension tool",
  "honest comparison: what $5 on remawt gets you vs $5,000 at an agency",
  "the glassmorphism card: a tiny detail that screams 'premium'",
  "how music tempo affects perceived energy and trustworthiness of your brand",
  "we built remawt because we needed remawt",
  "the next 12 months of AI video are going to be wild. here's why.",
  "recap: 100 posts, 100 angles on why video matters for SaaS",
];

const SYSTEM_PROMPT = `You are a founder writing LinkedIn posts about your product, Remawt.

Your writing style rules — these are NON-NEGOTIABLE:

1. VOICE: Write like a real human on LinkedIn. First person. Opinionated. Sometimes messy. You have a personality — slightly irreverent, direct, occasionally self-deprecating. You're not a brand account.

2. SENTENCE VARIETY: Mix aggressively. Some sentences are 3 words. Others run long with a couple clauses because that's how people actually think. Fragments are fine. Start sentences with "And" or "But" sometimes.

3. NO AI PATTERNS:
   - NEVER use arrow → or bullet → lists in more than 40% of posts. Use paragraphs, stories, single-line punches instead.
   - NEVER use words like: seamless, revolutionary, cutting-edge, game-changer, unlock, leverage, elevate, empower, harness, robust, comprehensive, innovative, transformative, delve, landscape
   - NEVER start with a question followed by a perfect answer
   - NEVER end every post with a neat CTA bow
   - NEVER use perfectly parallel structure in lists
   - Vary hashtag count: some posts 2 tags, some 5, some zero

4. STRUCTURE VARIETY: Each post should feel structurally different. Mix these freely:
   - Raw personal story / anecdote (specific details: dates, names, situations)
   - Hot take with reasoning
   - Short 2-3 sentence observation
   - Longer narrative with a twist
   - Data/numbers with commentary
   - Behind-the-scenes technical deep dive
   - Casual conversational tone, like texting a smart friend
   - Ranty / frustrated tone about industry problems

5. IMPERFECTION: Include occasional:
   - Parenthetical asides (like this)
   - Em dashes for emphasis — the way people actually write
   - Rhetorical questions that DON'T get immediately answered
   - Opinions someone might push back on
   - Admitting something was hard or didn't work at first

6. SPECIFICITY: Use concrete details, not vague claims. "2,847 videos generated last month" not "thousands of videos." "Last Tuesday" not "recently." Invent plausible specific details.

7. LENGTH VARIETY: Some posts are 3 lines. Some are 15+ lines. Don't make them all the same length.

8. FORMAT: Output ONLY the post text. No title. No markdown headers. No "Post #X" labels. Just the raw LinkedIn post content. Include hashtags naturally at the end (vary the count 0-5).

Here's context about the product:
${PRODUCT_CONTEXT}
`;

async function generatePost(
  client: GoogleGenerativeAI,
  angle: string,
  postNumber: number,
): Promise<string> {
  const model = client.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: 1.1, // higher temp = less predictable = less AI-detectable
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 1024,
    },
  });

  const prompt = `Write a LinkedIn post with this angle/topic: "${angle}"

This is post ${postNumber} of 100 in a content series. Make it feel natural and unique.
Remember: you're a founder, not a copywriter. Write like you talk.
If previous posts used lists, make this one a narrative. If they were long, make this one short. Keep it fresh.`;

  const chat = model.startChat({
    history: [{ role: "user", parts: [{ text: SYSTEM_PROMPT }] }],
  });

  const result = await chat.sendMessage(prompt);
  const text = result.response.text();
  return text.trim();
}

async function generateBatch(
  client: GoogleGenerativeAI,
  startIndex: number,
  batchSize: number,
): Promise<void> {
  const promises: Promise<void>[] = [];

  for (let i = 0; i < batchSize; i++) {
    const postNum = startIndex + i;
    if (postNum > TOTAL_POSTS) break;

    const angle = POST_ANGLES[(postNum - 1) % POST_ANGLES.length];
    const filePath = path.join(POSTS_DIR, `${postNum}.md`);

    // Skip if already exists
    if (fs.existsSync(filePath)) {
      console.log(`  Skipping post ${postNum} (already exists)`);
      continue;
    }

    const promise = generatePost(client, angle, postNum)
      .then((content) => {
        fs.writeFileSync(filePath, content, "utf-8");
        console.log(`  ✓ Post ${postNum} saved`);
      })
      .catch((err) => {
        console.error(`  ✗ Post ${postNum} failed: ${err.message}`);
      });

    promises.push(promise);
  }

  await Promise.all(promises);
}

async function main() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.error("Error: Set GOOGLE_AI_API_KEY environment variable");
    process.exit(1);
  }

  const client = new GoogleGenerativeAI(apiKey);

  // Ensure posts directory exists
  if (!fs.existsSync(POSTS_DIR)) {
    fs.mkdirSync(POSTS_DIR, { recursive: true });
  }

  // Clear existing posts if --fresh flag
  if (process.argv.includes("--fresh")) {
    const existing = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));
    existing.forEach((f) => fs.unlinkSync(path.join(POSTS_DIR, f)));
    console.log(`Cleared ${existing.length} existing posts.\n`);
  }

  console.log(`Generating ${TOTAL_POSTS} LinkedIn posts for Remawt...\n`);

  for (let batch = 0; batch < Math.ceil(TOTAL_POSTS / BATCH_SIZE); batch++) {
    const start = batch * BATCH_SIZE + 1;
    const end = Math.min(start + BATCH_SIZE - 1, TOTAL_POSTS);
    console.log(`Batch ${batch + 1}: Posts ${start}-${end}`);

    await generateBatch(client, start, BATCH_SIZE);

    // Small delay between batches to avoid rate limits
    if (end < TOTAL_POSTS) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const count = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md")).length;
  console.log(`\nDone! ${count} posts saved in ./posts/`);
}

main();
