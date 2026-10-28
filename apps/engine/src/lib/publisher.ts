/** Publisher from @remawt/publisher: `createPublisher(process.env)` → dryrun unless PUBLISHER_PROVIDER or a provider key is set. */
import { createPublisher, type Publisher } from "@remawt/publisher";

let instance: Publisher | null = null;
export function getPublisher(): Publisher {
  return (instance ??= createPublisher(process.env));
}
