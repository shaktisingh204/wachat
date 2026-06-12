import 'server-only';

/**
 * SabCRM Routing client — wraps the Rust `/v1/sabcrm/routing` surface
 * (crate `sabcrm-routing`, mounted by `sabnode-api`).
 *
 * Assignment rules: ordered, condition-gated rules that pick an assignee for
 * a record (`round_robin` / `least_assigned` / `fixed`) and write it onto the
 * record's `data.<assignField>` (default `owner`). `evaluate` applies the
 * first matching active rule; round-robin rotation is persisted atomically
 * server-side.
 *
 * Conditions reuse the workflow condition model (`{ field, operator, value }`
 * with the `evalCondition` operator vocabulary from
 * `src/lib/sabcrm/runtime.ts` — `eq` / `ne` / `in` / `nin` / `contains` /
 * `notContains` / `gt` / `gte` / `lt` / `lte` / `isEmpty` / `isNotEmpty`).
 *
 * Tenant scope is `projectId`; the Rust side requires a valid `AuthUser` JWT.
 * Wire shapes mirror `rust/crates/sabcrm-routing/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';

/** What fires a routing rule. */
export type SabcrmRoutingTrigger = 'record.created' | 'form.submission';

/** How an assignee is picked from the rule's roster. */
export type SabcrmRoutingStrategy = 'round_robin' | 'least_assigned' | 'fixed';

/**
 * One `{ field, operator, value }` condition — the workflow condition model.
 * `field` is a dotted path into the record's `data` map.
 */
export interface SabcrmRoutingCondition {
  field: string;
  /** Operator slug; defaults to `eq` server-side. */
  operator: string;
  value?: unknown;
}

/** A routing rule as returned by the Rust engine. */
export interface SabcrmRustRoutingRule {
  id: string;
  projectId: string;
  name: string;
  objectSlug: string;
  trigger: SabcrmRoutingTrigger;
  conditions: SabcrmRoutingCondition[];
  strategy: SabcrmRoutingStrategy;
  /** Member user-ids assignment rotates over. */
  assignees: string[];
  /** Record `data.<key>` the assignee is written to (default `owner`). */
  assignField: string;
  active: boolean;
  /** Priority order — lower runs first. */
  position: number;
  /** Round-robin rotation cursor (server-managed). */
  lastAssignedIndex: number;
  createdAt: string;
  updatedAt: string;
}

/** Input for {@link sabcrmRoutingApi.create}. */
export interface SabcrmRoutingRuleCreateInput {
  name: string;
  objectSlug: string;
  trigger?: SabcrmRoutingTrigger;
  conditions?: SabcrmRoutingCondition[];
  strategy?: SabcrmRoutingStrategy;
  assignees: string[];
  assignField?: string;
  active?: boolean;
  position?: number;
}

/** Flattened partial patch for {@link sabcrmRoutingApi.update}. */
export interface SabcrmRoutingRuleUpdateInput {
  name?: string;
  objectSlug?: string;
  trigger?: SabcrmRoutingTrigger;
  conditions?: SabcrmRoutingCondition[];
  strategy?: SabcrmRoutingStrategy;
  assignees?: string[];
  assignField?: string;
  active?: boolean;
  position?: number;
}

/** Filters for {@link sabcrmRoutingApi.list}. */
export interface SabcrmRoutingListParams {
  objectSlug?: string;
  trigger?: SabcrmRoutingTrigger;
  active?: boolean;
}

/** Input for {@link sabcrmRoutingApi.evaluate}. */
export interface SabcrmRoutingEvaluateInput {
  objectSlug: string;
  recordId: string;
  /** Which trigger's rules to consider. Defaults to `record.created`. */
  trigger?: SabcrmRoutingTrigger;
}

/**
 * `POST /evaluate` response. `matched: false` (everything else absent) means
 * no active rule accepted the record — it was left untouched.
 */
export interface SabcrmRoutingEvaluateResult {
  matched: boolean;
  ruleId?: string;
  ruleName?: string;
  assignee?: string;
  assignField?: string;
}

/** Encode query params, dropping undefined/empty values. */
function qs(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Raw `{ rules }` envelope from `GET /`. */
interface ListEnvelope {
  rules: SabcrmRustRoutingRule[];
}

/** Raw `{ rule }` envelope from `GET /{id}`, `POST /`, `PATCH /{id}`. */
interface SingleEnvelope {
  rule: SabcrmRustRoutingRule;
}

const BASE = '/v1/sabcrm/routing';

export const sabcrmRoutingApi = {
  /**
   * `GET /v1/sabcrm/routing` — list the project's rules in priority order
   * (`position` asc), optionally narrowed by object slug / trigger / active.
   */
  async list(
    projectId: string,
    params?: SabcrmRoutingListParams,
  ): Promise<SabcrmRustRoutingRule[]> {
    const res = await rustFetch<ListEnvelope>(
      `${BASE}${qs({
        projectId,
        objectSlug: params?.objectSlug,
        trigger: params?.trigger,
        active: params?.active,
      })}`,
    );
    return res.rules;
  },

  /** `GET /v1/sabcrm/routing/{id}` — fetch one rule. */
  async get(projectId: string, id: string): Promise<SabcrmRustRoutingRule> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    );
    return res.rule;
  },

  /** `POST /v1/sabcrm/routing` — create a rule. */
  async create(
    projectId: string,
    input: SabcrmRoutingRuleCreateInput,
  ): Promise<SabcrmRustRoutingRule> {
    const res = await rustFetch<SingleEnvelope>(BASE, {
      method: 'POST',
      body: JSON.stringify({ projectId, ...input }),
    });
    return res.rule;
  },

  /**
   * `PATCH /v1/sabcrm/routing/{id}` — partial update (flattened patch;
   * `lastAssignedIndex` is server-managed and never writable here).
   */
  async update(
    projectId: string,
    id: string,
    input: SabcrmRoutingRuleUpdateInput,
  ): Promise<SabcrmRustRoutingRule> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ projectId, ...input }) },
    );
    return res.rule;
  },

  /** `DELETE /v1/sabcrm/routing/{id}` — scoped delete. */
  remove(projectId: string, id: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },

  /**
   * `POST /v1/sabcrm/routing/evaluate` — apply the first matching active rule
   * to one record (writes `data.<assignField>` server-side, with atomic
   * round-robin rotation).
   */
  evaluate(
    projectId: string,
    input: SabcrmRoutingEvaluateInput,
  ): Promise<SabcrmRoutingEvaluateResult> {
    return rustFetch<SabcrmRoutingEvaluateResult>(`${BASE}/evaluate`, {
      method: 'POST',
      body: JSON.stringify({ projectId, ...input }),
    });
  },
};
