import DodoPayments from "dodopayments";

let dodoClient: DodoPayments | null = null;

export function getDodoClient(): DodoPayments {
    if (!dodoClient) {
        const apiKey = process.env.DODO_PAYMENTS_API_KEY;
        if (!apiKey) {
            throw new Error('DODO_PAYMENTS_API_KEY environment variable is required');
        }
        const environment = (process.env.DODO_PAYMENTS_ENVIRONMENT as 'test_mode' | 'live_mode') || 'test_mode';
        dodoClient = new DodoPayments({
            bearerToken: apiKey,
            environment,
        });
    }
    return dodoClient;
}