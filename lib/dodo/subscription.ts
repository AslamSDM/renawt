export const products = [
    {
        name: "SUBSCRIPTION_STARTER",
        productId: "pdt_0NXgVkOCld7OPSxqFhJpX",
        creditsPerCycle: 100,
    }
] as const;

export type Product = typeof products[number]['name'];

// export const isValidProduct = (name: string) => products.some(p => p.name === name);
// export const isValidSubscription = (name: string) => name === "SUBSCRIPTION_STARTER";
// export const isExtraCredits = (name: string) => name === "EXTRA_CREDITS";

export const productToIdMap = Object.fromEntries(
    products.map(p => [p.name, p.productId])
) as Record<string, string>;

export const productToCreditMap = Object.fromEntries(
    products.map(p => [p.name, p.creditsPerCycle])
) as Record<string, number>;