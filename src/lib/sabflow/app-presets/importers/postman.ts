/**
 * SabFlow — Postman Collection v2.1 → AppPreset importer (SERVER ONLY).
 *
 * Reads a Postman v2.1 (or v2.0) collection and produces a draft AppPreset.
 * Auto-imports always land with `status: 'draft'` and an `id` prefixed by
 * `postman-` to protect hand-curated presets.
 *
 * Companion: `SABFLOW_1000_APPS_PLAN.md` §4 (source 2) + §8 acceptance.
 */
import 'server-only';

import type {
  AppPreset,
  AppPresetAuth,
  AppPresetEndpoint,
  AppPresetField,
  AppPresetFieldLocation,
  AppPresetHttpMethod,
} from '../types';

/* ── Loose Postman v2.1 shapes ──────────────────────────────────────────── */

type PostmanInfo = {
  name?: string;
  description?: string | { content?: string };
  schema?: string;
};

type PostmanVariable = {
  key?: string;
  value?: string;
};

type PostmanAuth = {
  type?: string;
  bearer?: Array<{ key?: string; value?: string }>;
  basic?: Array<{ key?: string; value?: string }>;
  apikey?: Array<{ key?: string; value?: string; in?: string }>;
  oauth2?: Array<{ key?: string; value?: string }>;
};

type PostmanQueryParam = {
  key?: string;
  value?: string;
  disabled?: boolean;
};

type PostmanHeader = {
  key?: string;
  value?: string;
  disabled?: boolean;
};

type PostmanUrlObject = {
  raw?: string;
  protocol?: string;
  host?: string[] | string;
  path?: Array<string | { value?: string }>;
  query?: PostmanQueryParam[];
};

type PostmanBody = {
  mode?: string;
  raw?: string;
  urlencoded?: Array<{ key?: string; value?: string; disabled?: boolean }>;
  formdata?: Array<{ key?: string; value?: string; disabled?: boolean }>;
  options?: { raw?: { language?: string } };
};

type PostmanRequest = {
  method?: string;
  url?: string | PostmanUrlObject;
  header?: PostmanHeader[];
  body?: PostmanBody;
  auth?: PostmanAuth;
};

type PostmanItem = {
  name?: string;
  item?: PostmanItem[];
  request?: PostmanRequest;
};

export type PostmanCollection = {
  info?: PostmanInfo;
  item?: PostmanItem[];
  auth?: PostmanAuth;
  variable?: PostmanVariable[];
};

export type PostmanImportOverrides = {
  id?: string;
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function presetIdSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function todayIso(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function readDescription(d: PostmanInfo['description']): string | undefined {
  if (!d) return undefined;
  if (typeof d === 'string') return d;
  if (typeof d === 'object' && typeof d.content === 'string') return d.content;
  return undefined;
}

const HTTP_METHODS: readonly AppPresetHttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
] as const;

function normaliseMethod(raw: unknown): AppPresetHttpMethod {
  if (typeof raw !== 'string') return 'GET';
  const upper = raw.toUpperCase();
  return (HTTP_METHODS as readonly string[]).includes(upper)
    ? (upper as AppPresetHttpMethod)
    : 'GET';
}

function hostToString(host: PostmanUrlObject['host']): string | undefined {
  if (!host) return undefined;
  if (typeof host === 'string') return host;
  if (Array.isArray(host)) return host.join('.');
  return undefined;
}

function pathSegmentToString(seg: string | { value?: string }): string {
  if (typeof seg === 'string') return seg;
  if (seg && typeof seg.value === 'string') return seg.value;
  return '';
}

/** Convert Postman `:param` segments to preset `{param}` convention. */
function convertPathSegment(seg: string): string {
  if (seg.startsWith(':') && seg.length > 1) {
    return `{${seg.slice(1)}}`;
  }
  return seg;
}

function extractPathParams(path: string): string[] {
  const params: string[] = [];
  const re = /\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) {
    const name = m[1];
    // Skip postman `{{var}}` style (which would leave empty `{}` or `{var}`
    // here we just dedupe and avoid known double-brace artifacts).
    if (name && !name.startsWith('{') && !params.includes(name)) {
      params.push(name);
    }
  }
  return params;
}

/** Determine base URL from first request OR collection variables. */
function deriveBaseUrl(
  collection: PostmanCollection,
  firstUrl: PostmanUrlObject | undefined,
): string {
  // 1) Prefer collection variables named baseUrl / host / base_url
  if (Array.isArray(collection.variable)) {
    for (const v of collection.variable) {
      if (!v || typeof v.key !== 'string' || typeof v.value !== 'string') continue;
      const key = v.key.toLowerCase();
      if (key === 'baseurl' || key === 'base_url' || key === 'host') {
        const val = v.value.trim();
        if (val.length > 0) {
          if (/^https?:\/\//i.test(val)) return val.replace(/\/+$/, '');
          return `https://${val.replace(/\/+$/, '')}`;
        }
      }
    }
  }
  // 2) First request host
  if (firstUrl) {
    const host = hostToString(firstUrl.host);
    if (host && host.length > 0) {
      const protocol = firstUrl.protocol && firstUrl.protocol.length > 0
        ? firstUrl.protocol
        : 'https';
      return `${protocol}://${host}`;
    }
    if (typeof firstUrl.raw === 'string' && firstUrl.raw.length > 0) {
      try {
        const u = new URL(firstUrl.raw);
        return `${u.protocol}//${u.host}`;
      } catch {
        /* fall through */
      }
    }
  }
  return '';
}

/** Find the first request's URL object form (string urls coerced). */
function findFirstUrl(items: PostmanItem[] | undefined): PostmanUrlObject | undefined {
  if (!Array.isArray(items)) return undefined;
  for (const it of items) {
    if (it && it.request && it.request.url !== undefined) {
      const u = it.request.url;
      if (typeof u === 'string') {
        try {
          const parsed = new URL(u);
          return {
            raw: u,
            protocol: parsed.protocol.replace(/:$/, ''),
            host: parsed.host.split('.'),
            path: parsed.pathname.split('/').filter(Boolean),
          };
        } catch {
          return { raw: u };
        }
      }
      return u;
    }
    const nested = findFirstUrl(it.item);
    if (nested) return nested;
  }
  return undefined;
}

/* ── Auth derivation ─────────────────────────────────────────────────────── */

function deriveAuth(auth: PostmanAuth | undefined): AppPresetAuth {
  if (!auth || typeof auth.type !== 'string') {
    return { type: 'none' };
  }
  switch (auth.type) {
    case 'bearer':
      return { type: 'bearer', credentialType: 'http_header_auth' };
    case 'basic':
      return { type: 'basic', credentialType: 'http_basic_auth' };
    case 'apikey': {
      const entries = Array.isArray(auth.apikey) ? auth.apikey : [];
      let keyName: string | undefined;
      let inLocation: string | undefined;
      for (const e of entries) {
        if (!e || typeof e.key !== 'string') continue;
        if (e.key === 'key' && typeof e.value === 'string') keyName = e.value;
        if (e.key === 'in' && typeof e.value === 'string') inLocation = e.value;
      }
      const location = (inLocation ?? 'header').toLowerCase();
      if (location === 'query') {
        return {
          type: 'query_token',
          credentialType: 'http_header_auth',
          queryParam: keyName ?? 'api_key',
        };
      }
      return {
        type: 'header',
        credentialType: 'http_header_auth',
        header: keyName ?? 'X-API-Key',
      };
    }
    case 'oauth2':
      return { type: 'oauth2', credentialType: 'oauth2' };
    case 'noauth':
      return { type: 'none' };
    default:
      return { type: 'none' };
  }
}

/* ── Field derivation ────────────────────────────────────────────────────── */

const AUTH_HEADER_NAMES = new Set([
  'authorization',
  'x-api-key',
  'x-auth-token',
  'api-key',
  'apikey',
]);

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function buildFieldsForRequest(
  request: PostmanRequest,
  path: string,
): AppPresetField[] {
  const fields: AppPresetField[] = [];
  const seen = new Set<string>();

  // 1) Path params from `{name}` segments.
  for (const name of extractPathParams(path)) {
    if (seen.has(name)) continue;
    seen.add(name);
    fields.push({
      id: name,
      label: name,
      type: 'text',
      required: true,
      in: 'path',
    });
  }

  // 2) Query params.
  const urlObj =
    request.url && typeof request.url === 'object' ? request.url : undefined;
  if (urlObj && Array.isArray(urlObj.query)) {
    for (const q of urlObj.query) {
      if (!q || typeof q.key !== 'string' || q.key.length === 0) continue;
      if (q.disabled === true) continue;
      const id = q.key;
      if (seen.has(id)) continue;
      seen.add(id);
      const field: AppPresetField = {
        id,
        label: id,
        type: 'text',
        in: 'query',
      };
      if (typeof q.value === 'string' && q.value.length > 0) {
        field.defaultValue = q.value;
      }
      fields.push(field);
    }
  }

  // 3) Header params (skip auth-related).
  if (Array.isArray(request.header)) {
    for (const h of request.header) {
      if (!h || typeof h.key !== 'string' || h.key.length === 0) continue;
      if (h.disabled === true) continue;
      const lower = h.key.toLowerCase();
      if (AUTH_HEADER_NAMES.has(lower)) continue;
      if (lower === 'content-type' || lower === 'accept') continue;
      const id = h.key;
      if (seen.has(id)) continue;
      seen.add(id);
      const field: AppPresetField = {
        id,
        label: id,
        type: 'text',
        in: 'header',
      };
      if (typeof h.value === 'string') field.defaultValue = h.value;
      fields.push(field);
    }
  }

  // 4) Body.
  const body = request.body;
  if (body && typeof body.mode === 'string') {
    if (body.mode === 'raw' && typeof body.raw === 'string' && body.raw.length > 0) {
      const language = body.options?.raw?.language;
      let isJson = language === 'json';
      // Heuristic if language missing — look at content-type header.
      if (!isJson && Array.isArray(request.header)) {
        for (const h of request.header) {
          if (
            h &&
            typeof h.key === 'string' &&
            h.key.toLowerCase() === 'content-type' &&
            typeof h.value === 'string' &&
            h.value.toLowerCase().includes('application/json')
          ) {
            isJson = true;
            break;
          }
        }
      }
      // Final fallback: looks like JSON.
      const trimmed = body.raw.trim();
      if (!isJson && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
        isJson = true;
      }
      if (isJson && !seen.has('body')) {
        seen.add('body');
        fields.push({
          id: 'body',
          label: 'Body',
          type: 'json',
          in: 'body',
          defaultValue: safeJsonParse(body.raw),
        });
      } else if (!seen.has('body')) {
        seen.add('body');
        fields.push({
          id: 'body',
          label: 'Body',
          type: 'textarea',
          in: 'body',
          defaultValue: body.raw,
        });
      }
    } else if (body.mode === 'urlencoded' && Array.isArray(body.urlencoded)) {
      for (const p of body.urlencoded) {
        if (!p || typeof p.key !== 'string' || p.key.length === 0) continue;
        if (p.disabled === true) continue;
        if (seen.has(p.key)) continue;
        seen.add(p.key);
        const field: AppPresetField = {
          id: p.key,
          label: p.key,
          type: 'text',
          in: 'body',
        };
        if (typeof p.value === 'string') field.defaultValue = p.value;
        fields.push(field);
      }
    } else if (body.mode === 'formdata' && Array.isArray(body.formdata)) {
      for (const p of body.formdata) {
        if (!p || typeof p.key !== 'string' || p.key.length === 0) continue;
        if (p.disabled === true) continue;
        if (seen.has(p.key)) continue;
        seen.add(p.key);
        const field: AppPresetField = {
          id: p.key,
          label: p.key,
          type: 'text',
          in: 'body' as AppPresetFieldLocation,
        };
        if (typeof p.value === 'string') field.defaultValue = p.value;
        fields.push(field);
      }
    }
  }

  return fields;
}

/* ── Endpoint flattening ─────────────────────────────────────────────────── */

function buildEndpointPath(request: PostmanRequest): string {
  const url = request.url;
  if (!url) return '/';
  if (typeof url === 'string') {
    try {
      const u = new URL(url);
      const segments = u.pathname.split('/').filter(Boolean).map(convertPathSegment);
      return '/' + segments.join('/');
    } catch {
      // Possibly a raw template like `{{baseUrl}}/users/:id`
      const stripped = url.replace(/^.*?\/\/[^/]+/, '');
      const segments = stripped
        .split('?')[0]
        .split('/')
        .filter(Boolean)
        .map(convertPathSegment);
      return '/' + segments.join('/');
    }
  }
  const rawPath = Array.isArray(url.path) ? url.path : [];
  const segments = rawPath
    .map(pathSegmentToString)
    .filter((s) => s.length > 0)
    .map(convertPathSegment);
  return '/' + segments.join('/');
}

function dedupeEndpointId(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let i = 2;
  while (used.has(`${base}_${i}`)) i++;
  const next = `${base}_${i}`;
  used.add(next);
  return next;
}

function flattenItems(
  items: PostmanItem[] | undefined,
  folderPath: string[],
  usedIds: Set<string>,
): AppPresetEndpoint[] {
  if (!Array.isArray(items)) return [];
  const out: AppPresetEndpoint[] = [];
  for (const it of items) {
    if (!it) continue;
    const name = typeof it.name === 'string' ? it.name : 'untitled';
    if (it.request) {
      const method = normaliseMethod(it.request.method);
      const path = buildEndpointPath(it.request);
      const idBase = slug([...folderPath, name].join(' ')) || 'endpoint';
      const id = dedupeEndpointId(idBase, usedIds);
      const fields = buildFieldsForRequest(it.request, path);
      out.push({ id, label: name, method, path, fields });
    } else if (Array.isArray(it.item)) {
      out.push(...flattenItems(it.item, [...folderPath, name], usedIds));
    }
  }
  return out;
}

/* ── Public API ──────────────────────────────────────────────────────────── */

/**
 * Convert a Postman v2.1 / v2.0 collection into a draft AppPreset.
 *
 * - `id` is always prefixed `postman-` to protect hand-curated presets.
 * - Status is always `draft`.
 * - `lastVerified` is today's UTC date.
 */
export function postmanToPreset(
  collection: unknown,
  overrides: PostmanImportOverrides = {},
): AppPreset {
  if (!isRecord(collection)) {
    throw new Error('postmanToPreset: collection must be an object');
  }
  const info = isRecord(collection.info) ? (collection.info as PostmanInfo) : {};
  const name = typeof info.name === 'string' && info.name.length > 0
    ? info.name
    : 'Imported Postman collection';

  const baseSlug = overrides.id && overrides.id.length > 0
    ? presetIdSlug(overrides.id)
    : presetIdSlug(name);
  const ensuredSlug = baseSlug.length > 0 ? baseSlug : 'untitled';
  const id = ensuredSlug.startsWith('postman-')
    ? ensuredSlug
    : `postman-${ensuredSlug}`;

  const description = readDescription(info.description);

  const items = Array.isArray((collection as PostmanCollection).item)
    ? (collection as PostmanCollection).item
    : [];

  const firstUrl = findFirstUrl(items);
  const baseUrl = deriveBaseUrl(collection as PostmanCollection, firstUrl);

  const auth = deriveAuth(
    isRecord(collection.auth) ? (collection.auth as PostmanAuth) : undefined,
  );

  const usedIds = new Set<string>();
  const endpoints = flattenItems(items, [], usedIds);

  const preset: AppPreset = {
    id,
    name,
    category: 'Imported (Postman)',
    iconName: 'LuPackage',
    version: 1,
    lastVerified: todayIso(),
    status: 'draft',
    auth,
    baseUrl,
    endpoints,
  };
  if (description) {
    preset.description = truncate(description, 200);
  }
  return preset;
}
