/**
 * Helper that emits a standardised CRUD spec set for a resource.
 *
 * Most SabNode modules follow the same shape:
 *
 *   GET    /<resource>            → list
 *   POST   /<resource>            → create
 *   GET    /<resource>/[id]       → get
 *   PATCH  /<resource>/[id]       → update
 *   DELETE /<resource>/[id]       → delete
 *
 * Hand-writing 5 EndpointSpec objects per resource × 100+ resources is
 * not realistic. `crudResource()` returns the full set, pre-wired to
 * `rust-fwd` against the corresponding Rust crate path, so a CRM module
 * fits in a few lines:
 *
 *   ...crudResource({
 *     module: 'crm',
 *     resource: 'leads',
 *     basePath: '/crm/leads',
 *     rustPath: '/v1/crm/leads',
 *     scopeRead: 'crm:leads:read',
 *     scopeWrite: 'crm:leads:write',
 *   })
 *
 * Use `verbs` to opt out of operations the upstream doesn't support
 * (some Rust crates are read-only; some only have create + delete).
 */

import type { EndpointSpec, Verb } from './types';

export interface CrudOptions {
  module: string;
  resource: string;
  /** Path under `/api/v1` for the collection endpoint, e.g. `/crm/leads`. */
  basePath: string;
  /** Path on the Rust side for the collection endpoint. */
  rustPath: string;
  /** Scope required for reads. */
  scopeRead: string;
  /** Scope required for writes. */
  scopeWrite: string;
  /** Resource id segment name. Defaults to the singular of the resource
   *  (`leads` → `leadId`). Override when the Rust crate uses a different
   *  param name. */
  idParam?: string;
  /** Minimum tier for read operations. Default `FREE`. */
  tierRead?: 'FREE' | 'PRO' | 'ENTERPRISE';
  /** Minimum tier for write operations. Default `FREE`. */
  tierWrite?: 'FREE' | 'PRO' | 'ENTERPRISE';
  /** Restrict to a subset of verbs. Default: all five. */
  verbs?: ReadonlyArray<'list' | 'get' | 'create' | 'update' | 'delete'>;
  /** Webhook events to emit on each write verb. */
  emits?: {
    create?: string;
    update?: string;
    delete?: string;
  };
  /** Friendly resource name for OpenAPI summaries. Defaults to a
   *  capitalised version of `resource`. */
  display?: string;
}

const generic2xx = (kind: string) => ({
  description: `${kind} response`,
  schema: { type: 'object' as const },
});
const stdAuthResponses = {
  '401': { description: 'Missing or invalid API key' },
  '429': { description: 'Rate limit exceeded' },
};

function singular(plural: string): string {
  if (plural.endsWith('ies')) return `${plural.slice(0, -3)}y`;
  if (plural.endsWith('ses')) return plural.slice(0, -2);
  if (plural.endsWith('s')) return plural.slice(0, -1);
  return plural;
}

function camelize(input: string): string {
  return input.replace(/[-_]([a-z0-9])/g, (_, c) => c.toUpperCase());
}

export function crudResource(opts: CrudOptions): EndpointSpec[] {
  const idParam = opts.idParam ?? `${camelize(singular(opts.resource))}Id`;
  const tierRead = opts.tierRead ?? 'FREE';
  const tierWrite = opts.tierWrite ?? 'FREE';
  const verbs = (opts.verbs ?? ['list', 'get', 'create', 'update', 'delete']) as Verb[];
  const display = opts.display ?? opts.resource;

  const out: EndpointSpec[] = [];

  if (verbs.includes('list')) {
    out.push({
      module: opts.module,
      resource: opts.resource,
      verb: 'list',
      path: opts.basePath,
      method: 'GET',
      scope: opts.scopeRead,
      tier: tierRead,
      summary: `List ${display}`,
      responses: { '2xx': generic2xx(`Page of ${display}`), ...stdAuthResponses },
      delegate: { kind: 'rust-fwd', path: opts.rustPath, method: 'GET' },
    });
  }
  if (verbs.includes('create')) {
    out.push({
      module: opts.module,
      resource: opts.resource,
      verb: 'create',
      path: opts.basePath,
      method: 'POST',
      scope: opts.scopeWrite,
      tier: tierWrite,
      summary: `Create ${display}`,
      requestBody: { required: true, schema: { type: 'object' } },
      responses: { '2xx': generic2xx(`Created ${display}`), '400': { description: 'Validation failed' }, ...stdAuthResponses },
      delegate: { kind: 'rust-fwd', path: opts.rustPath, method: 'POST' },
      ...(opts.emits?.create ? { emits: [opts.emits.create] } : {}),
    });
  }
  if (verbs.includes('get')) {
    out.push({
      module: opts.module,
      resource: opts.resource,
      verb: 'get',
      path: `${opts.basePath}/[${idParam}]`,
      method: 'GET',
      scope: opts.scopeRead,
      tier: tierRead,
      summary: `Get ${display}`,
      pathParams: [{ name: idParam, schema: { type: 'string' } }],
      responses: { '2xx': generic2xx(display), '404': { description: 'Not found' }, ...stdAuthResponses },
      delegate: { kind: 'rust-fwd', path: `${opts.rustPath}/{${idParam}}`, method: 'GET' },
    });
  }
  if (verbs.includes('update')) {
    out.push({
      module: opts.module,
      resource: opts.resource,
      verb: 'update',
      path: `${opts.basePath}/[${idParam}]`,
      method: 'PATCH',
      scope: opts.scopeWrite,
      tier: tierWrite,
      summary: `Update ${display}`,
      pathParams: [{ name: idParam, schema: { type: 'string' } }],
      requestBody: { required: true, schema: { type: 'object' } },
      responses: { '2xx': generic2xx(`Updated ${display}`), '404': { description: 'Not found' }, ...stdAuthResponses },
      delegate: { kind: 'rust-fwd', path: `${opts.rustPath}/{${idParam}}`, method: 'PATCH' },
      ...(opts.emits?.update ? { emits: [opts.emits.update] } : {}),
    });
  }
  if (verbs.includes('delete')) {
    out.push({
      module: opts.module,
      resource: opts.resource,
      verb: 'delete',
      path: `${opts.basePath}/[${idParam}]`,
      method: 'DELETE',
      scope: opts.scopeWrite,
      tier: tierWrite,
      summary: `Delete ${display}`,
      pathParams: [{ name: idParam, schema: { type: 'string' } }],
      responses: { '2xx': generic2xx('Acknowledged'), '404': { description: 'Not found' }, ...stdAuthResponses },
      delegate: { kind: 'rust-fwd', path: `${opts.rustPath}/{${idParam}}`, method: 'DELETE' },
      ...(opts.emits?.delete ? { emits: [opts.emits.delete] } : {}),
    });
  }
  return out;
}
