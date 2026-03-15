export type ProductType = {
  name: string;
  title: string;
  productId: string;
  annualProductId?: string;
  creditsPerCycle: number;
  price: string;
  annualPrice?: string;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
  type: "SUBSCRIPTION_PLANS" | "EXTRA_CREDITS";
};

export const products: ProductType[] = [
  {
    type: "SUBSCRIPTION_PLANS",
    name: "SUBSCRIPTION_STARTER",
    title: "Starter",
    productId: "pdt_0NZiEwZzmh4cnrXMd1CHZ",
    annualProductId: "pdt_0NZiEwZzmh4cnrXMd1CHZ", // TODO: replace with actual annual product ID from Dodo dashboard
    creditsPerCycle: 100,
    price: "20",
    annualPrice: "216",
    description: "Perfect for trying out the platform",
    features: [
      "100 video credits/month",
      "720p & 1080p exports",
      "All templates included",
      "Standard rendering",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    type: "SUBSCRIPTION_PLANS",
    name: "SUBSCRIPTION_CREATOR",
    title: "Creator",
    productId: "pdt_0NZiF3JVG17K5uXKLcoqS",
    annualProductId: "pdt_0NZiF3JVG17K5uXKLcoqS", // TODO: replace with actual annual product ID from Dodo dashboard
    creditsPerCycle: 500,
    price: "39",
    annualPrice: "421",
    description: "Best value for regular creators",
    features: [
      "500 video credits/month",
      "Up to 4K exports",
      "All templates + custom",
      "Priority rendering",
      "API access",
    ],
    cta: "Get Started",
    popular: true,
  },
  {
    type: "SUBSCRIPTION_PLANS",
    name: "SUBSCRIPTION_STUDIO",
    title: "Studio",
    productId: "pdt_0NZiFASqHgwe6Xw6IUmoN",
    annualProductId: "pdt_0NZiFASqHgwe6Xw6IUmoN", // TODO: replace with actual annual product ID from Dodo dashboard
    creditsPerCycle: 2000,
    price: "149",
    annualPrice: "1,609",
    description: "For agencies and high-volume creators",
    features: [
      "2000 video credits/month",
      "Up to 4K exports",
      "All templates + custom",
      "Fastest rendering",
      "API access",
      "Dedicated support",
    ],
    cta: "Get Started",
    popular: false,
  },
] as const;

export type Product = (typeof products)[number]["name"];

export const subscriptionPlans = products.filter(
  (product) => product.type === "SUBSCRIPTION_PLANS",
);

export const productToIdMap = Object.fromEntries(
  products.map((p) => [p.name, p.productId]),
) as Record<string, string>;

export const annualProductToIdMap = Object.fromEntries(
  products.map((p) => [p.name, p.annualProductId || p.productId]),
) as Record<string, string>;

export const productToCreditMap = Object.fromEntries(
  products.map((p) => [p.name, p.creditsPerCycle]),
) as Record<string, number>;
