import DodoPayments from "dodopayments";

let dodoClient: DodoPayments | null = null;

export function getDodoClient(): DodoPayments {
    if (!dodoClient) {
        const apiKey = process.env.DODO_PAYMENTS_API_KEY;
        if (!apiKey) {
            throw new Error('DODO_PAYMENTS_API_KEY environment variable is required');
        }
        dodoClient = new DodoPayments({
            bearerToken: apiKey,
            environment: 'test_mode',
        });
    }
    return dodoClient;
}