import { promises as fs } from "fs";
import path from "path";

export interface BlogMeta {
  /** markdown file name in /posts without extension */
  file: string;
  slug: string;
  title: string;
  description: string;
  date: string;
}

/**
 * SEO metadata for the casual posts in /posts/*.md.
 * Titles/descriptions are keyword-aligned; bodies live in the .md files.
 */
export const BLOG_POSTS: BlogMeta[] = [
  {
    file: "1",
    slug: "stop-making-saas-videos-in-imovie",
    title: "Why I Stopped Making SaaS Videos in iMovie",
    description:
      "Hand-editing freemium SaaS videos at 2 AM is brutal. Here's why we automated product video creation with AI instead.",
    date: "2026-03-01",
  },
  {
    file: "2",
    slug: "most-saas-demo-videos-are-boring",
    title: "Most SaaS Demo Videos Are Boring — Here's the Fix",
    description:
      "90% of SaaS demo videos feel like Windows Movie Maker in 2008. What makes a product demo actually worth watching.",
    date: "2026-03-05",
  },
  {
    file: "3",
    slug: "url-to-product-video",
    title: "What Happens When You Turn a URL Into a Product Video",
    description:
      "Paste your SaaS URL and watch an AI build a product video around it. A look under the hood of URL-to-video generation.",
    date: "2026-03-10",
  },
  {
    file: "4",
    slug: "demo-video-mistake-saas-founders-make",
    title: "The Demo Video Mistake Most SaaS Founders Make",
    description:
      "Founders obsess over features and forget the story. How to make a product demo video that actually sells.",
    date: "2026-03-15",
  },
  {
    file: "5",
    slug: "beat-synced-animations-product-video",
    title: "Why Beat-Synced Animations Make Product Videos Feel Premium",
    description:
      "Beat-synced motion is the subtle trick behind premium-feeling product videos. Here's how and why it works.",
    date: "2026-03-20",
  },
  {
    file: "6",
    slug: "building-an-ai-video-generator",
    title: "The Hardest Part of Building an AI Video Generator",
    description:
      "The biggest facepalm moments from building Remawt, an AI product video generator for SaaS.",
    date: "2026-03-25",
  },
  {
    file: "7",
    slug: "saas-video-options-ranked",
    title: "Your SaaS Video Options, Ranked",
    description:
      "Agencies, freelancers, DIY, or AI? A blunt ranking of the ways to make product and demo videos for SaaS.",
    date: "2026-04-01",
  },
  {
    file: "8",
    slug: "product-video-on-your-landing-page",
    title: "Why Product Video Belongs on Your Landing Page",
    description:
      "Video on a landing page isn't a nice-to-have anymore. Why an explainer or demo video lifts conversion.",
    date: "2026-04-06",
  },
  {
    file: "9",
    slug: "how-we-use-remotion",
    title: "How We Use Remotion to Render Product Videos",
    description:
      "A behind-the-scenes look at how Remawt uses Remotion to render programmatic, code-driven product videos.",
    date: "2026-04-11",
  },
  {
    file: "10",
    slug: "we-automated-screen-recordings",
    title: "I Hated Screen Recordings — Then We Automated Them",
    description:
      "Screen recordings are tedious and easy to botch. How automated capture turns them into clean product demos.",
    date: "2026-04-16",
  },
];

export function getPostMeta(slug: string): BlogMeta | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

/** Reads the raw markdown body for a post (build-time). */
export async function getPostBody(file: string): Promise<string> {
  const fp = path.join(process.cwd(), "posts", `${file}.md`);
  return fs.readFile(fp, "utf8");
}
