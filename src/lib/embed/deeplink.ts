/**
 * Universal deeplink helpers — `sabnode://module/resource/id`.
 *
 * Used by the mobile SDKs, the Chrome extension, and the web shell to
 * route inbound links to a canonical (module, resource, id) tuple plus
 * arbitrary query params.
 */

export const DEEPLINK_SCHEME = 'sabnode';

export interface Deeplink {
  /** Top-level product module — e.g. "wachat", "crm", "sabflow". */
  module: string;
  /** Resource within the module — e.g. "contact", "broadcast", "form". */
  resource: string;
  /** Resource id (opaque). */
  id: string;
  /** Optional URL-style query parameters. */
  params?: Record<string, string>;
}

const SEGMENT_RE = /^[A-Za-z0-9_.~-]+$/;

function assertSegment(name: string, value: string): void {
  if (!value) throw new Error(`encodeDeeplink: ${name} is required`);
  if (!SEGMENT_RE.test(value)) {
    throw new Error(`encodeDeeplink: ${name} contains invalid characters`);
  }
}

/**
 * Encode a {@link Deeplink} into its `sabnode://module/resource/id?…` form.
 */
export function encodeDeeplink(link: Deeplink): string {
  assertSegment('module', link.module);
  assertSegment('resource', link.resource);
  assertSegment('id', link.id);
  let url = `${DEEPLINK_SCHEME}://${link.module}/${link.resource}/${encodeURIComponent(
    link.id,
  )}`;
  if (link.params && Object.keys(link.params).length > 0) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(link.params)) usp.set(k, v);
    url += `?${usp.toString()}`;
  }
  return url;
}

/**
 * Decode a `sabnode://…` URL back into a {@link Deeplink} object.
 *
 * Returns null when the input does not parse — callers should treat that
 * as a soft failure and fall through to a default route.
 */
export function decodeDeeplink(input: string): Deeplink | null {
  if (typeof input !== 'string') return null;
  const prefix = `${DEEPLINK_SCHEME}://`;
  if (!input.startsWith(prefix)) return null;
  const remainder = input.slice(prefix.length);
  const [pathPart, queryPart] = remainder.split('?', 2);
  const segments = pathPart.split('/').filter(Boolean);
  if (segments.length < 3) return null;

  const [moduleSeg, resourceSeg, ...idParts] = segments;
  if (!SEGMENT_RE.test(moduleSeg) || !SEGMENT_RE.test(resourceSeg)) {
    return null;
  }
  const id = decodeURIComponent(idParts.join('/'));
  if (!id) return null;

  const params: Record<string, string> = {};
  if (queryPart) {
    const usp = new URLSearchParams(queryPart);
    usp.forEach((value, key) => {
      params[key] = value;
    });
  }

  return {
    module: moduleSeg,
    resource: resourceSeg,
    id,
    params: Object.keys(params).length ? params : undefined,
  };
}

/** Map a deeplink to an in-app web path the Next.js router can handle. */
export function deeplinkToWebPath(link: Deeplink): string {
  const base = `/${link.module}/${link.resource}/${encodeURIComponent(link.id)}`;
  if (!link.params || Object.keys(link.params).length === 0) return base;
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(link.params)) usp.set(k, v);
  return `${base}?${usp.toString()}`;
}
