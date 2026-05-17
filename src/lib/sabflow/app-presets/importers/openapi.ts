/**
 * SabFlow — OpenAPI 3.x → AppPreset importer.
 *
 * Pure, side-effect-free conversion. The HTTP route in
 * `src/app/api/sabflow/presets/import-openapi/route.ts` is the thin shell that
 * parses input, calls `openApiToPreset`, and persists the result.
 *
 * Conversion contract is defined in `SABFLOW_1000_APPS_PLAN.md` §3 + §4
 * (acceptance criteria in §8). All auto-imports land in `draft` state and use
 * the forced id prefix `openapi-` so they never overwrite hand-curated or
 * `n8n-` imported presets.
 */

import type {
  AppPreset,
  AppPresetAuth,
  AppPresetEndpoint,
  AppPresetField,
  AppPresetFieldLocation,
  AppPresetFieldType,
  AppPresetHttpMethod,
  AppPresetSelectOption,
} from '../types';

/* ── Public types ────────────────────────────────────────────────────────── */

export type OpenApiImportOverrides = {
  /** Override the derived preset id. Always re-prefixed with `openapi-`. */
  id?: string;
};

export type OpenApiImportResult = {
  preset: AppPreset;
  warnings: string[];
};

/* ── Internal narrow types — we don't depend on a full OpenAPI typings pkg ─ */

type Json = unknown;
type JsonObject = Record<string, unknown>;

const HTTP_METHODS: readonly AppPresetHttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
] as const;

const METHOD_LOOKUP = new Set<string>(['get', 'post', 'put', 'patch', 'delete']);

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function isObject(v: unknown): v is JsonObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function pathToSlug(p: string): string {
  // strip `{...}` braces, collapse separators to underscores
  return p
    .replace(/[{}]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function today(): string {
  // YYYY-MM-DD — preset `lastVerified` shape per types.ts
  return new Date().toISOString().slice(0, 10);
}

/** Resolve `{var}` placeholders against `servers[0].variables[var].default`. */
function resolveServerUrl(server: JsonObject | undefined): string {
  if (!server) return '';
  const url = asString(server.url);
  if (!url) return '';
  const vars = isObject(server.variables) ? server.variables : undefined;
  if (!vars) return url;
  return url.replace(/\{(\w+)\}/g, (match, name) => {
    const entry = vars[name];
    if (isObject(entry) && typeof entry.default === 'string') {
      return entry.default;
    }
    return match;
  });
}

/* ── Auth derivation ─────────────────────────────────────────────────────── */

function deriveAuth(
  spec: JsonObject,
  warnings: string[],
): AppPresetAuth {
  const components = isObject(spec.components) ? spec.components : undefined;
  const schemes = components && isObject(components.securitySchemes)
    ? components.securitySchemes
    : undefined;
  if (!schemes) return { type: 'none' };

  const names = Object.keys(schemes);
  if (names.length === 0) return { type: 'none' };
  if (names.length > 1) {
    warnings.push(
      `Multiple security schemes found (${names.join(
        ', ',
      )}); picked first sensible one.`,
    );
  }

  // Prefer schemes in this order: bearer > basic > apiKey > oauth2 > anything else
  const prioritised = [...names].sort((a, b) => {
    const sa = isObject(schemes[a]) ? schemes[a] as JsonObject : undefined;
    const sb = isObject(schemes[b]) ? schemes[b] as JsonObject : undefined;
    return rankScheme(sa) - rankScheme(sb);
  });

  for (const name of prioritised) {
    const raw = schemes[name];
    if (!isObject(raw)) continue;
    const auth = mapScheme(raw);
    if (auth) return auth;
  }
  return { type: 'none' };
}

function rankScheme(scheme: JsonObject | undefined): number {
  if (!scheme) return 99;
  const type = asString(scheme.type);
  const sub = asString(scheme.scheme);
  if (type === 'http' && sub === 'bearer') return 0;
  if (type === 'http' && sub === 'basic') return 1;
  if (type === 'apiKey') return 2;
  if (type === 'oauth2') return 3;
  return 50;
}

function mapScheme(scheme: JsonObject): AppPresetAuth | undefined {
  const type = asString(scheme.type);
  if (type === 'http') {
    const sub = asString(scheme.scheme)?.toLowerCase();
    if (sub === 'bearer') {
      return { type: 'bearer', credentialType: 'http_header_auth' };
    }
    if (sub === 'basic') {
      return { type: 'basic', credentialType: 'http_basic_auth' };
    }
    return undefined;
  }
  if (type === 'apiKey') {
    const where = asString(scheme.in);
    const headerName = asString(scheme.name);
    if (where === 'header' && headerName) {
      return {
        type: 'header',
        credentialType: 'http_header_auth',
        header: headerName,
      };
    }
    if (where === 'query' && headerName) {
      return {
        type: 'query_token',
        credentialType: 'http_header_auth',
        queryParam: headerName,
      };
    }
    return undefined;
  }
  if (type === 'oauth2') {
    return { type: 'oauth2', credentialType: 'oauth2' };
  }
  return undefined;
}

/* ── Field type mapping ──────────────────────────────────────────────────── */

function mapOpenApiTypeToField(
  schema: JsonObject | undefined,
): { type: AppPresetFieldType; options?: AppPresetSelectOption[] } {
  if (!schema) return { type: 'text' };
  const type = asString(schema.type);
  const format = asString(schema.format);
  const enumValues = Array.isArray(schema.enum) ? schema.enum : undefined;

  if (enumValues && type === 'string') {
    const options: AppPresetSelectOption[] = enumValues
      .filter((v): v is string => typeof v === 'string')
      .map((v) => ({ value: v, label: v }));
    if (options.length > 0) return { type: 'select', options };
  }

  if (type === 'integer' || type === 'number') return { type: 'number' };
  if (type === 'boolean') return { type: 'toggle' };
  if (type === 'array' || type === 'object') return { type: 'json' };
  if (type === 'string') {
    if (format === 'password') return { type: 'password' };
    return { type: 'text' };
  }
  return { type: 'text' };
}

/* ── Endpoint construction ───────────────────────────────────────────────── */

type ParameterObject = {
  name: string;
  in: AppPresetFieldLocation;
  required?: boolean;
  description?: string;
  schema?: JsonObject;
};

function collectParameters(
  pathItem: JsonObject,
  operation: JsonObject,
): ParameterObject[] {
  const result: ParameterObject[] = [];
  const seen = new Set<string>();
  const sources: unknown[] = [];
  if (Array.isArray(operation.parameters)) sources.push(...operation.parameters);
  if (Array.isArray(pathItem.parameters)) sources.push(...pathItem.parameters);

  for (const raw of sources) {
    if (!isObject(raw)) continue;
    const name = asString(raw.name);
    const where = asString(raw.in);
    if (!name || !where) continue;
    if (where !== 'path' && where !== 'query' && where !== 'header') continue;
    const key = `${where}:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      name,
      in: where,
      required: raw.required === true,
      description: asString(raw.description),
      schema: isObject(raw.schema) ? raw.schema : undefined,
    });
  }
  return result;
}

function parameterToField(p: ParameterObject): AppPresetField {
  const mapped =
    p.in === 'path' || p.in === 'header'
      ? { type: 'text' as AppPresetFieldType }
      : mapOpenApiTypeToField(p.schema);

  const field: AppPresetField = {
    id: p.name,
    label: p.name,
    type: mapped.type,
    in: p.in,
  };
  if (p.required) field.required = true;
  if (p.description) field.description = p.description.slice(0, 200);
  if (mapped.options) field.options = mapped.options;
  // Path params are always required by OpenAPI spec
  if (p.in === 'path') field.required = true;
  return field;
}

function requestBodyField(operation: JsonObject): AppPresetField | undefined {
  const body = operation.requestBody;
  if (!isObject(body)) return undefined;
  const content = isObject(body.content) ? body.content : undefined;
  if (!content) return undefined;
  const json = isObject(content['application/json'])
    ? (content['application/json'] as JsonObject)
    : undefined;
  if (!json) return undefined;
  const field: AppPresetField = {
    id: 'body',
    label: 'Request body (JSON)',
    type: 'json',
    in: 'body',
  };
  if (body.required === true) field.required = true;
  return field;
}

function endpointIdFor(method: string, path: string): string {
  const slug = pathToSlug(path);
  return slug ? `${method.toLowerCase()}_${slug}` : method.toLowerCase();
}

/* ── Top-level conversion ────────────────────────────────────────────────── */

export function openApiToPreset(
  spec: unknown,
  overrides: OpenApiImportOverrides = {},
): AppPreset {
  const result = openApiToPresetVerbose(spec, overrides);
  return result.preset;
}

export function openApiToPresetVerbose(
  spec: unknown,
  overrides: OpenApiImportOverrides = {},
): OpenApiImportResult {
  if (!isObject(spec)) {
    throw new Error('OpenAPI spec must be a JSON object.');
  }
  const openapiField = asString(spec.openapi);
  if (!openapiField || !openapiField.startsWith('3.')) {
    throw new Error(
      `Only OpenAPI 3.x is supported (got openapi=${
        openapiField ?? 'undefined'
      }).`,
    );
  }
  const info = isObject(spec.info) ? spec.info : {};
  const title = asString(info.title) ?? 'Untitled API';
  const description = asString(info.description) ?? '';

  // Servers
  const servers = Array.isArray(spec.servers) ? spec.servers : [];
  const firstServer = servers.find((s): s is JsonObject => isObject(s));
  const baseUrl = resolveServerUrl(firstServer) || '';
  if (!baseUrl) {
    throw new Error('Spec must provide at least one `servers[].url`.');
  }

  // Paths
  const paths = isObject(spec.paths) ? spec.paths : {};
  const pathEntries = Object.entries(paths);
  if (pathEntries.length === 0) {
    throw new Error('Spec has no `paths` to import.');
  }

  const warnings: string[] = [];
  const auth = deriveAuth(spec, warnings);

  const endpoints: AppPresetEndpoint[] = [];
  const seenEndpointIds = new Set<string>();

  for (const [pathStr, rawPathItem] of pathEntries) {
    if (!isObject(rawPathItem)) continue;
    for (const methodKey of Object.keys(rawPathItem)) {
      if (!METHOD_LOOKUP.has(methodKey.toLowerCase())) continue;
      const operation = rawPathItem[methodKey];
      if (!isObject(operation)) continue;
      const method = methodKey.toUpperCase() as AppPresetHttpMethod;
      if (!HTTP_METHODS.includes(method)) continue;

      const params = collectParameters(rawPathItem, operation);
      const fields: AppPresetField[] = params.map(parameterToField);

      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        const body = requestBodyField(operation);
        if (body) fields.push(body);
      }

      let endpointId = endpointIdFor(method, pathStr);
      let suffix = 2;
      while (seenEndpointIds.has(endpointId)) {
        endpointId = `${endpointIdFor(method, pathStr)}_${suffix++}`;
      }
      seenEndpointIds.add(endpointId);

      const opId = asString(operation.operationId);
      const summary = asString(operation.summary);
      const label = opId ?? summary ?? `${method} ${pathStr}`;

      const endpoint: AppPresetEndpoint = {
        id: endpointId,
        label,
        method,
        path: pathStr,
        fields,
      };
      const opDescription = asString(operation.description) ?? summary;
      if (opDescription) {
        endpoint.description = opDescription.slice(0, 200);
      }
      endpoints.push(endpoint);
    }
  }

  if (endpoints.length === 0) {
    throw new Error('Spec has no usable operations under `paths`.');
  }

  // Build id with forced prefix
  const baseSlug =
    (overrides.id && slugify(overrides.id)) ||
    slugify(title) ||
    `imported-${Math.random().toString(36).slice(2, 8)}`;
  const id = baseSlug.startsWith('openapi-') ? baseSlug : `openapi-${baseSlug}`;

  const preset: AppPreset = {
    id,
    name: title,
    description: description ? description.slice(0, 200) : '',
    category: 'Imported (OpenAPI)',
    iconName: 'LuPackage',
    version: 1,
    lastVerified: today(),
    status: 'draft',
    auth,
    baseUrl,
    endpoints,
  };

  return { preset, warnings };
}

/* ── Cheap output validator (route uses this before persisting) ──────────── */

export function validatePreset(preset: unknown): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!isObject(preset)) {
    return { ok: false, errors: ['Preset is not an object.'] };
  }
  if (typeof preset.id !== 'string' || preset.id.length === 0) {
    errors.push('Missing preset.id');
  }
  if (typeof preset.name !== 'string' || preset.name.length === 0) {
    errors.push('Missing preset.name');
  }
  if (typeof preset.baseUrl !== 'string' || preset.baseUrl.length === 0) {
    errors.push('Missing preset.baseUrl');
  }
  if (!isObject(preset.auth) || typeof (preset.auth as JsonObject).type !== 'string') {
    errors.push('Missing or malformed preset.auth');
  }
  if (!Array.isArray(preset.endpoints) || preset.endpoints.length === 0) {
    errors.push('preset.endpoints must be a non-empty array');
  } else {
    for (const [i, e] of (preset.endpoints as unknown[]).entries()) {
      if (!isObject(e)) {
        errors.push(`endpoint[${i}] is not an object`);
        continue;
      }
      if (typeof e.id !== 'string' || !e.id) errors.push(`endpoint[${i}].id missing`);
      if (typeof e.label !== 'string') errors.push(`endpoint[${i}].label missing`);
      if (typeof e.method !== 'string') errors.push(`endpoint[${i}].method missing`);
      if (typeof e.path !== 'string') errors.push(`endpoint[${i}].path missing`);
      if (!Array.isArray(e.fields)) errors.push(`endpoint[${i}].fields not array`);
    }
  }
  return { ok: errors.length === 0, errors };
}
