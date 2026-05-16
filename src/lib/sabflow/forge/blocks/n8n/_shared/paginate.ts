/**
 * Shared pagination helper for ported n8n forge blocks.
 *
 * Cursor extraction is the caller's job. APIs use wildly different cursor
 * conventions (`Link: …; rel="next"` for Shopify, `paging.next.after` for
 * HubSpot, `starting_after` for Stripe, `nextPageToken` for Google, …), so
 * this helper stays generic and asks the consumer to return both the page
 * items and the next cursor.
 *
 * Usage:
 *
 *   const all = await paginateAll<Order>({
 *     async fetchPage(cursor) {
 *       const { data, headers } = await apiRequest({ … });
 *       return { items: data.orders, nextCursor: nextFromLink(headers.get('link')) };
 *     },
 *     maxItems: 500,
 *   });
 *
 * Or stream with the async generator if the consumer wants to bail early.
 */

export type PaginateInput<T> = {
  /** Per-page fetcher — receives the cursor (or undefined for first page) and returns one page. */
  fetchPage: (cursor: string | undefined) => Promise<{ items: T[]; nextCursor?: string }>;
  /** Hard cap on total items returned (defaults to 1000). */
  maxItems?: number;
};

const DEFAULT_MAX_ITEMS = 1000;
/** Safety stop: we never walk past this many fetches even if the API keeps returning cursors. */
const MAX_PAGES = 1000;

export async function* paginate<T>(input: PaginateInput<T>): AsyncGenerator<T> {
  const max = input.maxItems ?? DEFAULT_MAX_ITEMS;
  let cursor: string | undefined = undefined;
  let yielded = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { items, nextCursor } = await input.fetchPage(cursor);
    for (const item of items) {
      if (yielded >= max) return;
      yield item;
      yielded++;
    }
    if (!nextCursor || yielded >= max) return;
    cursor = nextCursor;
  }
}

export async function paginateAll<T>(input: PaginateInput<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of paginate(input)) {
    out.push(item);
  }
  return out;
}
