import { WABaStatus } from './types';

/**
 * NOTE: KB articles are no longer mocked here — `DocumentationList` reads the
 * real, global knowledge base through the `wachat-setup-kb` Rust crate via the
 * `listSetupKbArticles` server action.
 *
 * `fetchStatus` is an unrelated client-side connection-status diagnostic used
 * by `WhatsAppTools` and is intentionally still a stub (no crate backs it yet).
 */
export async function fetchStatus(): Promise<WABaStatus> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        status: 'pending',
        lastChecked: new Date().toISOString(),
        qualityRating: 'green',
      });
    }, 800);
  });
}
