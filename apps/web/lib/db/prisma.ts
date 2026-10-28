import { getPrisma, withDbRetry } from "@remawt/db";

export const prisma = getPrisma();
export { withDbRetry };
