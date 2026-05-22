/**
 * Extended CRUD spec emitter.
 *
 * Most SabNode resources support far more than list/get/create/update/delete.
 * `crudExtendedResource()` returns a complete set covering:
 *
 *   - Core CRUD (5)              list, get, create, update, delete
 *   - State transitions (8)      archive, restore, activate, deactivate,
 *                                lock, unlock, duplicate, transfer
 *   - Bulk operations (4)        bulk-create, bulk-update, bulk-delete,
 *                                bulk-archive
 *   - Discovery (4)              search, count, autocomplete, export
 *   - Sub-resources (~16)        notes, attachments, comments, history,
 *                                activity, tags, sharing, audit log —
 *                                each as list + create + delete where
 *                                meaningful
 *   - Verb hooks (3)             status, validate, sync
 *
 * Every emitted spec targets the matching path on the Rust side. The
 * Rust crate is the source of truth for whether each verb is actually
 * implemented — for unsupported verbs, the Rust handler returns 501 and
 * the generated TS handler surfaces that to the caller without us
 * needing to know upfront. This is cheaper than per-crate inventorying.
 *
 * Each resource emits ~36 endpoints. Apply judiciously: lookup tables
 * (countries, currencies, units) don't benefit from `archive` or
 * `transfer`, so use `crudResource()` for those instead.
 */

import type { EndpointSpec } from './types';

export interface CrudExtendedOptions {
  module: string;
  resource: string;
  basePath: string;
  rustPath: string;
  scopeRead: string;
  scopeWrite: string;
  idParam?: string;
  display?: string;
  tierRead?: 'FREE' | 'PRO' | 'ENTERPRISE';
  tierWrite?: 'FREE' | 'PRO' | 'ENTERPRISE';
  /** Opt OUT of specific verb groups. */
  exclude?: ReadonlyArray<
    | 'crud'
    | 'state'
    | 'bulk'
    | 'discovery'
    | 'sub-notes'
    | 'sub-attachments'
    | 'sub-comments'
    | 'sub-history'
    | 'sub-activity'
    | 'sub-tags'
    | 'sub-sharing'
    | 'sub-audit'
    | 'sub-related'
    | 'verbs'
  >;
  /** Webhook event prefix; emits `<prefix>.created`, `.updated`, `.deleted`. */
  eventPrefix?: string;
  verbs?: ReadonlyArray<string>;
  emits?: {
    create?: string;
    update?: string;
    delete?: string;
  };
}

const generic2xx = { description: 'OK', schema: { type: 'object' as const } };
const auth = {
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

/* Helper to keep each emitted spec terse. */
function endpoint(
  opts: CrudExtendedOptions,
  verb: EndpointSpec['verb'],
  pathSuffix: string,
  rustSuffix: string,
  method: EndpointSpec['method'],
  scope: string,
  summary: string,
  extras: Partial<EndpointSpec> = {},
): EndpointSpec {
  const tier = method === 'GET' ? (opts.tierRead ?? 'FREE') : (opts.tierWrite ?? 'FREE');
  const hasBody = ['POST', 'PATCH', 'PUT'].includes(method);
  return {
    module: opts.module,
    resource: opts.resource,
    verb,
    path: `${opts.basePath}${pathSuffix}`,
    method,
    scope,
    tier,
    summary,
    responses: { '2xx': generic2xx, ...auth, ...(extras.responses ?? {}) },
    delegate: {
      kind: 'rust-fwd',
      path: `${opts.rustPath}${rustSuffix}`,
      method,
    },
    ...(hasBody ? { requestBody: { required: true, schema: { type: 'object' } } } : {}),
    ...extras,
  };
}

export function crudExtendedResource(opts: CrudExtendedOptions): EndpointSpec[] {
  const idParam = opts.idParam ?? `${camelize(singular(opts.resource))}Id`;
  const display = opts.display ?? opts.resource;
  const exclude = new Set(opts.exclude ?? []);
  const idPath = `/[${idParam}]`;
  const rustIdPath = `/{${idParam}}`;
  const pathParam = { name: idParam, schema: { type: 'string' as const } };
  const ev = opts.eventPrefix;

  const out: EndpointSpec[] = [];

  /* ── Core CRUD ──────────────────────────────────────────────────────── */
  if (!exclude.has('crud')) {
    out.push(
      endpoint(opts, 'list', '', '', 'GET', opts.scopeRead, `List ${display}`),
      endpoint(opts, 'create', '', '', 'POST', opts.scopeWrite, `Create ${display}`, {
        emits: opts.emits?.create ? [opts.emits.create] : (ev ? [`${ev}.created`] : undefined),
      }),
      endpoint(opts, 'get', idPath, rustIdPath, 'GET', opts.scopeRead, `Get ${display}`, {
        pathParams: [pathParam],
        responses: { '2xx': generic2xx, '404': { description: 'Not found' }, ...auth },
      }),
      endpoint(opts, 'update', idPath, rustIdPath, 'PATCH', opts.scopeWrite, `Update ${display}`, {
        pathParams: [pathParam],
        emits: opts.emits?.update ? [opts.emits.update] : (ev ? [`${ev}.updated`] : undefined),
        responses: { '2xx': generic2xx, '404': { description: 'Not found' }, ...auth },
      }),
      endpoint(opts, 'update', idPath, rustIdPath, 'PUT', opts.scopeWrite, `Replace ${display}`, {
        pathParams: [pathParam],
        responses: { '2xx': generic2xx, '404': { description: 'Not found' }, ...auth },
      }),
      endpoint(opts, 'delete', idPath, rustIdPath, 'DELETE', opts.scopeWrite, `Delete ${display}`, {
        pathParams: [pathParam],
        emits: opts.emits?.delete ? [opts.emits.delete] : (ev ? [`${ev}.deleted`] : undefined),
        responses: { '2xx': generic2xx, '404': { description: 'Not found' }, ...auth },
      }),
    );
  }

  /* ── State transitions ─────────────────────────────────────────────── */
  if (!exclude.has('state')) {
    const states: Array<[string, string]> = [
      ['archive', 'Archived'],
      ['restore', 'Restored'],
      ['activate', 'Activated'],
      ['deactivate', 'Deactivated'],
      ['lock', 'Locked'],
      ['unlock', 'Unlocked'],
      ['duplicate', 'Duplicated'],
    ];
    for (const [verb, past] of states) {
      out.push(
        endpoint(opts, 'custom', `${idPath}/${verb}`, `${rustIdPath}/${verb}`, 'POST', opts.scopeWrite, `${past} ${display}`, {
          pathParams: [pathParam],
          emits: ev ? [`${ev}.${verb === 'duplicate' ? 'duplicated' : verb + 'd'}`] : undefined,
        }),
      );
    }
    out.push(
      endpoint(opts, 'custom', `${idPath}/transfer`, `${rustIdPath}/transfer`, 'POST', opts.scopeWrite, `Transfer ${display} ownership`, {
        pathParams: [pathParam],
        emits: ev ? [`${ev}.transferred`] : undefined,
      }),
    );
  }

  /* ── Bulk operations ───────────────────────────────────────────────── */
  if (!exclude.has('bulk')) {
    out.push(
      endpoint(opts, 'custom', '/bulk', '/bulk', 'POST', opts.scopeWrite, `Bulk create ${display}`),
      endpoint(opts, 'custom', '/bulk', '/bulk', 'PATCH', opts.scopeWrite, `Bulk update ${display}`),
      endpoint(opts, 'custom', '/bulk', '/bulk', 'DELETE', opts.scopeWrite, `Bulk delete ${display}`),
      endpoint(opts, 'custom', '/bulk/archive', '/bulk/archive', 'POST', opts.scopeWrite, `Bulk archive ${display}`),
      endpoint(opts, 'custom', '/bulk/restore', '/bulk/restore', 'POST', opts.scopeWrite, `Bulk restore ${display}`),
      endpoint(opts, 'custom', '/bulk/tag', '/bulk/tag', 'POST', opts.scopeWrite, `Bulk apply tags to ${display}`),
    );
  }

  /* ── Discovery ─────────────────────────────────────────────────────── */
  if (!exclude.has('discovery')) {
    out.push(
      endpoint(opts, 'list', '/search', '/search', 'GET', opts.scopeRead, `Full-text search ${display}`, {
        queryParams: [
          { name: 'q', schema: { type: 'string' }, required: true, description: 'Search query' },
          { name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
        ],
      }),
      endpoint(opts, 'list', '/count', '/count', 'GET', opts.scopeRead, `Count ${display}`),
      endpoint(opts, 'list', '/autocomplete', '/autocomplete', 'GET', opts.scopeRead, `Autocomplete ${display}`, {
        queryParams: [
          { name: 'q', schema: { type: 'string' }, required: true },
          { name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
        ],
      }),
      endpoint(opts, 'list', '/export', '/export', 'GET', opts.scopeRead, `Export ${display} as CSV`, {
        queryParams: [{ name: 'format', schema: { type: 'string', enum: ['csv', 'xlsx', 'json'], default: 'csv' } }],
      }),
      endpoint(opts, 'custom', '/import', '/import', 'POST', opts.scopeWrite, `Import ${display} from CSV`),
    );
  }

  /* ── Sub-resources: notes / attachments / comments / etc. ────────────
   *
   * Skip the sub-resource entirely when its path segment matches the
   * parent resource's name — Next.js rejects two same-name slugs in one
   * route (e.g. `/tags/[tagId]/tags/[tagId]`), and emitting
   * `/tags/[tagId]/tags` is semantically meaningless anyway (tags on a
   * tag). Also auto-deconflict the sub-id-param when it collides with
   * the parent idParam by prefixing with `sub`. */
  const sub = (
    key: NonNullable<CrudExtendedOptions['exclude']>[number],
    seg: string,
    label: string,
    subIdParamRaw: string,
  ): void => {
    if (exclude.has(key)) return;
    if (seg === opts.resource) return; // self-collision, skip
    const subIdParam = subIdParamRaw === idParam ? `sub${subIdParamRaw[0].toUpperCase()}${subIdParamRaw.slice(1)}` : subIdParamRaw;
    out.push(
      endpoint(opts, 'list', `${idPath}/${seg}`, `${rustIdPath}/${seg}`, 'GET', opts.scopeRead, `List ${label} on a ${singular(display)}`, {
        pathParams: [pathParam],
      }),
      endpoint(opts, 'create', `${idPath}/${seg}`, `${rustIdPath}/${seg}`, 'POST', opts.scopeWrite, `Add a ${label.replace(/s$/, '')} to a ${singular(display)}`, {
        pathParams: [pathParam],
      }),
      endpoint(opts, 'delete', `${idPath}/${seg}/[${subIdParam}]`, `${rustIdPath}/${seg}/{${subIdParam}}`, 'DELETE', opts.scopeWrite, `Remove a ${label.replace(/s$/, '')} from a ${singular(display)}`, {
        pathParams: [pathParam, { name: subIdParam, schema: { type: 'string' } }],
      }),
    );
  };

  sub('sub-notes', 'notes', 'notes', 'noteId');
  sub('sub-attachments', 'attachments', 'attachments', 'attachmentId');
  sub('sub-comments', 'comments', 'comments', 'commentId');
  sub('sub-tags', 'tags', 'tags', 'tagId');
  sub('sub-sharing', 'shares', 'shares', 'shareId');

  /* History / activity / audit are read-only sub-resources. */
  if (!exclude.has('sub-history')) {
    out.push(
      endpoint(opts, 'list', `${idPath}/history`, `${rustIdPath}/history`, 'GET', opts.scopeRead, `Version history for a ${singular(display)}`, {
        pathParams: [pathParam],
      }),
    );
  }
  if (!exclude.has('sub-activity')) {
    out.push(
      endpoint(opts, 'list', `${idPath}/activity`, `${rustIdPath}/activity`, 'GET', opts.scopeRead, `Activity feed for a ${singular(display)}`, {
        pathParams: [pathParam],
      }),
    );
  }
  if (!exclude.has('sub-audit')) {
    out.push(
      endpoint(opts, 'list', `${idPath}/audit-log`, `${rustIdPath}/audit-log`, 'GET', opts.scopeRead, `Audit log for a ${singular(display)}`, {
        pathParams: [pathParam],
      }),
    );
  }
  if (!exclude.has('sub-related')) {
    out.push(
      endpoint(opts, 'list', `${idPath}/related`, `${rustIdPath}/related`, 'GET', opts.scopeRead, `Related entities for a ${singular(display)}`, {
        pathParams: [pathParam],
      }),
    );
  }

  /* ── Verb hooks ────────────────────────────────────────────────────── */
  if (!exclude.has('verbs')) {
    out.push(
      endpoint(opts, 'get', `${idPath}/status`, `${rustIdPath}/status`, 'GET', opts.scopeRead, `Status of a ${singular(display)}`, {
        pathParams: [pathParam],
      }),
      endpoint(opts, 'custom', `${idPath}/validate`, `${rustIdPath}/validate`, 'POST', opts.scopeRead, `Validate a ${singular(display)}`, {
        pathParams: [pathParam],
      }),
      endpoint(opts, 'custom', '/sync', '/sync', 'POST', opts.scopeWrite, `Sync ${display} from upstream`),
    );
  }

  if (opts.verbs) {
    const verbsSet = new Set(opts.verbs);
    return out.filter(spec => {
      if (['list', 'get', 'create', 'update', 'delete'].includes(spec.verb)) {
        return verbsSet.has(spec.verb);
      }
      return true;
    });
  }

  return out;
}
