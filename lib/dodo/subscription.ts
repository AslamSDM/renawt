export type ProductType = {
    name: string,
    title: string,
    productId: string,
    creditsPerCycle: number,
    price: string,
    description: string,
    features: string[],
    cta: string,
    popular: boolean,
    type: "SUBSCRIPTION_PLANS" | "EXTRA_CREDITS"
}

export const products: ProductType[] = [
    {
        type: "SUBSCRIPTION_PLANS",
        name: "SUBSCRIPTION_STARTER",
        title: "Starter",
        productId: "pdt_0NXgVkOCld7OPSxqFhJpX",
        creditsPerCycle: 100,
        price: "20",
        description: "Perfect for trying out the platform",
        features: [
            "100 video credits",
            "720p & 1080p exports",
            "All templates included",
            "Standard rendering",
            "No expiration",
        ],
        cta: "Buy Credits",
        popular: false,
    },
    {
        type: "SUBSCRIPTION_PLANS",
        name: "SUBSCRIPTION_CREATOR",
        title: "Creator",
        productId: "",
        creditsPerCycle: 500,
        price: "39",
        description: "Best value for regular creators",
        features: [
            "500 video credits",
            "Up to 4K exports",
            "All templates + custom",
            "Priority rendering",
            "No expiration",
            "API access",
        ],
        cta: "Buy Credits",
        popular: true,
    },
    {
        type: "SUBSCRIPTION_PLANS",
        name: "SUBSCRIPTION_CREATOR",
        title: "Studio",
        creditsPerCycle: 2000,
        productId: "",
        price: "149",
        description: "For agencies and high-volume creators",
        features: [
            "2000 video credits",
            "Up to 4K exports",
            "All templates + custom",
            "Fastest rendering",
            "No expiration",
            "API access",
            "Dedicated support",
        ],
        cta: "Buy Credits",
        popular: false,
    },
] as const;

export type Product = typeof products[number]['name'];

// export const isValidProduct = (name: string) => products.some(p => p.name === name);
// export const isValidSubscription = (name: string) => name === "SUBSCRIPTION_STARTER";

export const subscriptionPlans = products.filter(
    (product) => product.type === "SUBSCRIPTION_PLANS"
);

export const productToIdMap = Object.fromEntries(
    products.map(p => [p.name, p.productId])
) as Record<string, string>;

export const productToCreditMap = Object.fromEntries(
    products.map(p => [p.name, p.creditsPerCycle])
) as Record<string, number>;