export interface FaqItem {
  q: string;
  a: string;
}

export interface SeoLanding {
  slug: string;
  /** <title> and H1 keyword phrasing */
  keyword: string;
  title: string;
  description: string;
  /** H1 — should contain the target keyword */
  h1Lead: string;
  h1Accent: string;
  subhead: string;
  /** intro paragraph, keyword-rich but readable */
  intro: string;
  benefits: { t: string; d: string }[];
  faqs: FaqItem[];
}

export const SEO_LANDINGS: SeoLanding[] = [
  {
    slug: "ai-product-videos",
    keyword: "AI product videos",
    title: "AI Product Videos — Create Product Videos with AI | Remawt",
    description:
      "Make AI product videos from a single prompt. Remawt turns your SaaS product or website URL into a finished product video in minutes, with no editing software to learn.",
    h1Lead: "AI product videos,",
    h1Accent: "made in minutes.",
    subhead:
      "Describe the video you want and Remawt's AI builds it. One prompt in, a finished product video out.",
    intro:
      "Remawt makes AI product videos for SaaS and software teams. Describe your product, or paste your URL, and the AI writes the script, captures your product, scores the cuts, and renders the whole thing. You skip the timeline, the agency quotes, and the week of back-and-forth, and get a product video the same afternoon you thought of it.",
    benefits: [
      {
        t: "Prompt to video",
        d: "Type what you want or paste your product URL. The AI handles the script, the capture, the motion, and the music.",
      },
      {
        t: "Looks like a studio made it",
        d: "Kinetic captions, beat-synced cuts, and a 4K master, without a studio's timeline or budget.",
      },
      {
        t: "Every aspect ratio",
        d: "One render gives you nine auto-cropped versions for YouTube, TikTok, Reels, LinkedIn, and in-app.",
      },
      {
        t: "Editable when you need it",
        d: "Open the editor to change a line, retime a shot, or swap a clip. AI speed, but you stay in control.",
      },
    ],
    faqs: [
      {
        q: "What is an AI product video?",
        a: "It's a product or demo video that AI builds from a text prompt or a URL, instead of one you film and edit by hand. Remawt writes the script, captures your product, and renders the video for you.",
      },
      {
        q: "How do I make an AI product video?",
        a: "Sign up for Remawt, type a prompt about your product or paste your website URL, and the AI generates the video in minutes. Download it as-is, or tweak it in the editor first.",
      },
      {
        q: "Are the videos good enough for marketing?",
        a: "Yes. You get a 4K video with captions and beat-matched edits that works for launch pages, ads, social, and onboarding.",
      },
    ],
  },
  {
    slug: "product-demo-generator",
    keyword: "product demo generator",
    title: "Product Demo Generator — AI Product Demo Videos in Minutes",
    description:
      "Remawt is an AI product demo generator that turns your software into a polished demo video automatically. Generate product demos from a prompt or URL — no screen recording marathons.",
    h1Lead: "The product demo",
    h1Accent: "generator.",
    subhead:
      "Generate a product demo video from a prompt or your URL. The AI records your product, writes the walkthrough, and edits it.",
    intro:
      "Remawt is a product demo generator for SaaS teams. Instead of recording your screen, re-recording the parts you fumbled, narrating, and then editing all of it together, you describe the demo you want. The AI captures your product, writes the walkthrough, and renders a clean demo video. Good for launches, sales calls, onboarding, and changelog posts.",
    benefits: [
      {
        t: "No screen-recording marathons",
        d: "The AI captures and narrates your product flow for you. No OBS, no fifth take because you clicked the wrong tab.",
      },
      {
        t: "Walkthroughs that land",
        d: "The pacing is built to show what the product does before anyone loses interest.",
      },
      {
        t: "On-brand every time",
        d: "Drop in your brand kit, fonts, and colors so every demo looks like it belongs to your product.",
      },
      {
        t: "Update in seconds",
        d: "Shipped a new feature? Regenerate the demo instead of re-recording the whole thing.",
      },
    ],
    faqs: [
      {
        q: "What is a product demo generator?",
        a: "It's a tool that creates a demo video of your software for you. Remawt does the capture, the script, and the edit from a prompt or a URL.",
      },
      {
        q: "Can I generate a SaaS demo without recording my screen?",
        a: "Yes. Remawt captures your product on its own, so you don't have to record your screen or talk over it. You just describe the demo you want.",
      },
      {
        q: "How long does it take to generate a product demo?",
        a: "A few minutes for most demos. You get a 4K version plus cropped cuts for social and in-app use.",
      },
    ],
  },
  {
    slug: "ai-video-generator",
    keyword: "AI video generator",
    title: "AI Video Generator for SaaS — Prompt to Video | Remawt",
    description:
      "Remawt is an AI video generator that turns a prompt or URL into a cinematic video in minutes. Built for SaaS product demos, launch videos, explainers, and social clips.",
    h1Lead: "AI video generator",
    h1Accent: "for software.",
    subhead:
      "Type a prompt, get a finished video. Remawt's AI writes it, scores it, and renders it.",
    intro:
      "Remawt is an AI video generator built for software and SaaS, not for stock footage. Tell it what you need, whether that's a product demo, a launch teaser, an explainer, or a quick feature-drop reel, and it generates the video for you. There are no templates to fight and no timeline to edit. You write a prompt and you get a video back.",
    benefits: [
      {
        t: "One prompt, full video",
        d: "Give it the brief, the vibe, and the call to action. It returns a scripted, scored, captioned video.",
      },
      {
        t: "Made for your product, not stock",
        d: "Most AI video tools glue together stock clips. Remawt shows your actual product instead.",
      },
      {
        t: "Nine formats from one render",
        d: "Landscape, vertical, and square cuts for every channel, made automatically from the same video.",
      },
      {
        t: "Edit without starting over",
        d: "Open the editor to fix a shot, a caption, or a beat. You keep the speed and lose nothing.",
      },
    ],
    faqs: [
      {
        q: "What can Remawt's AI video generator make?",
        a: "Product demos, launch videos, explainer videos, onboarding clips, and feature-drop reels for software and SaaS, all from a prompt or a URL.",
      },
      {
        q: "Is Remawt different from other AI video generators?",
        a: "Most AI video generators stitch together stock footage. Remawt captures and shows your real product, so the video actually looks like your software.",
      },
      {
        q: "Do I need video editing experience?",
        a: "No. The AI hands you a finished video. You only open the editor if you want to fine-tune something.",
      },
    ],
  },
  {
    slug: "explainer-video-maker",
    keyword: "explainer video maker",
    title: "Explainer Video Maker — AI Explainer Videos in Minutes | Remawt",
    description:
      "Make professional explainer videos with AI. Remawt's explainer video maker turns a prompt or URL into a clear, cinematic explainer for your product — no animation or editing skills needed.",
    h1Lead: "The explainer video",
    h1Accent: "maker.",
    subhead:
      "Make a clear explainer video from a prompt. The AI writes the script and animates it for you.",
    intro:
      "Remawt is an explainer video maker for product and marketing teams. Say what you want to explain, or paste your URL, and the AI works out the order to tell it in, writes the script, animates the visuals, and renders the video. Use it on a landing page, in onboarding, or in an ad, without booking an animation studio or waiting three weeks for a first cut.",
    benefits: [
      {
        t: "Story first",
        d: "The AI lays out a clear problem-then-solution flow, so people actually follow what you're explaining.",
      },
      {
        t: "Motion without animators",
        d: "Kinetic typography and clean motion graphics, made for you.",
      },
      {
        t: "Built to hold attention",
        d: "The pacing and captions are there to keep people watching until the point lands.",
      },
      {
        t: "Refresh anytime",
        d: "Messaging changed? Regenerate the explainer instead of paying for another round of edits.",
      },
    ],
    faqs: [
      {
        q: "How do I make an explainer video with AI?",
        a: "Type a prompt about what you want to explain, or paste your product URL. Remawt writes the script, animates it, and renders the explainer video in minutes.",
      },
      {
        q: "How much does an explainer video cost?",
        a: "A studio explainer runs into the thousands and takes weeks. With Remawt it comes out of your plan credits in minutes. The pricing page has the current plans.",
      },
      {
        q: "Can I edit the explainer video after it's generated?",
        a: "Yes. Use the AI version as a starting point and adjust the script, timing, or visuals in the editor.",
      },
    ],
  },
  {
    slug: "saas-demo-video",
    keyword: "SaaS demo video maker",
    title: "SaaS Demo Video Maker — AI Demo Videos for SaaS | Remawt",
    description:
      "Create SaaS demo videos with AI. Remawt turns your SaaS product or URL into a polished demo video in minutes — built specifically for software launches, sales, and onboarding.",
    h1Lead: "SaaS demo videos,",
    h1Accent: "on autopilot.",
    subhead:
      "Turn your SaaS product into a demo video with AI. Made for launches, sales decks, and onboarding.",
    intro:
      "Remawt is a SaaS demo video maker. Paste your product URL or describe your software, and the AI captures the interface, writes the walkthrough, and renders a demo video that does its job in a sales call. It's built for SaaS specifically, so the demo shows your real product working, not generic stock clips that could belong to anyone.",
    benefits: [
      {
        t: "Made for SaaS",
        d: "Built to capture software interfaces and product flows, which most video tools handle badly.",
      },
      {
        t: "From URL to demo",
        d: "Paste your website and the AI builds the demo around your actual product.",
      },
      {
        t: "Ready for a sales call",
        d: "On-brand demos you can drop into a landing page, an outbound email, or a pitch deck.",
      },
      {
        t: "Scale your demos",
        d: "Make a demo per feature, per persona, or per campaign without paying for each one.",
      },
    ],
    faqs: [
      {
        q: "What is a SaaS demo video?",
        a: "It's a video that shows how a software product works and why it's worth using. Remawt makes SaaS demo videos from your product URL or a prompt.",
      },
      {
        q: "Can Remawt build a demo from my website URL?",
        a: "Yes. Paste your SaaS URL and the AI captures your product and builds the demo around it.",
      },
      {
        q: "Is Remawt good for product launches?",
        a: "Yes, that's a big part of what it's for. From one render you get a hero demo plus social cuts in every aspect ratio.",
      },
    ],
  },
];

export function getLanding(slug: string): SeoLanding | undefined {
  return SEO_LANDINGS.find((l) => l.slug === slug);
}
