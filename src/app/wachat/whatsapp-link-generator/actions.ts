'use server';

/**
 * Legacy shim. The TinyURL round-trip that used to live here has been
 * replaced by the internal shortener in the `wachat-link-generator` Rust
 * crate. This re-export keeps any stray importer working while routing
 * through the new action (which the page now calls directly).
 *
 * @deprecated import `shortenLink` from
 *   `@/app/actions/wachat-link-generator.actions` instead.
 */
import { shortenLink } from '@/app/actions/wachat-link-generator.actions';

export async function shortenUrlAction(originalUrl: string): Promise<string | null> {
  const res = await shortenLink(originalUrl);
  return res.success ? res.shortUrl ?? null : null;
}
