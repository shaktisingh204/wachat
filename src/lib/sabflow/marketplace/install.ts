/**
 * SabFlow Marketplace — one-click template install.
 *
 * Phase C.10 · sub-task #6.
 *
 * Workflow:
 *   1. Look up the published template by `slug`.
 *   2. Cross-check `requiredCredentials[]` against the user's installed
 *      credential types (re-uses the same credential-resolution philosophy
 *      as `executor/credentials/import-n8n.ts` — match by `CredentialType`,
 *      treat the *type* as the install gate, not a per-row credential).
 *   3. If any types are missing, return `{ status: 'needs_credentials' }`
 *      with the missing list. The UI deep-links to the new-credential page
 *      for each type so the user can fix the gap without losing context.
 *   4. Otherwise clone the flow body via the Phase B.5 §9 import path
 *      (`remapFlowIds`), stamp it with the requester's `userId`, insert
 *      into `sabflows`, and bump `installCount` atomically.
 *
 * The helper is split into small named functions so the API route stays
 * thin and the credential-resolution step is testable in isolation.
 */

import 'server-only';

import { ObjectId } from 'mongodb';
import { createId } from '@paralleldrive/cuid2';

import { getSabFlowCollection } from '@/lib/sabflow/db';
import { getCredentials } from '@/lib/sabflow/credentials/db';
import type { CredentialType } from '@/lib/sabflow/credentials/types';
import type {
  SabFlowDoc,
  Group,
  Edge,
  SabFlowEvent,
  Variable,
} from '@/lib/sabflow/types';

import {
  getMarketplaceTemplate,
  incrementInstallCount,
  type MarketplaceTemplate,
  type MarketplaceTemplateFlow,
} from './templates';

/* ── Result discriminated union ────────────────────────────────────────── */

export type InstallTemplateResult =
  | {
      status: 'not_found';
    }
  | {
      status: 'needs_credentials';
      /** Credential types the user must add before install can proceed. */
      missing: CredentialType[];
      /** Full required list — useful when the UI wants to show "X of Y ready". */
      required: CredentialType[];
      /** Slug echoed back so the modal can re-submit after the user fixes the gap. */
      templateSlug: string;
    }
  | {
      status: 'ok';
      /** Newly-created flow id (hex `ObjectId`). */
      flowId: string;
      /** Editor deep-link the UI should navigate to. */
      editorUrl: string;
      /** Updated install count (post-increment), for cache-hint refresh. */
      installCount: number | null;
    };

/* ── Public API ────────────────────────────────────────────────────────── */

export interface InstallTemplateOptions {
  /** Marketplace template slug to install. */
  templateSlug: string;
  /** Caller's user id — becomes `SabFlowDoc.userId` on the cloned row. */
  userId: string;
  /**
   * Workspace scope used when resolving the caller's installed credential
   * types. The current SabFlow auth model maps workspace ↔ user, so the
   * default is `userId`. Callers with a richer multi-workspace model can
   * pass an explicit value.
   */
  workspaceId?: string;
  /**
   * When `false`, the install plan is computed and missing credentials are
   * surfaced, but no flow is cloned. Useful for the modal's preview pass.
   * Defaults to `true`.
   */
  performWrite?: boolean;
  /* ── Test seams ──────────────────────────────────────────────────── */
  /**
   * Override the marketplace lookup. Default: `getMarketplaceTemplate`.
   * Returning `null` is treated as "not_found".
   */
  _lookupTemplate?: (slug: string) => Promise<MarketplaceTemplate | null>;
  /**
   * Override the credential-type lister. Default: `getCredentials` projected
   * down to the distinct set of types the user owns.
   */
  _listOwnedTypes?: (workspaceId: string) => Promise<Set<CredentialType>>;
  /** Override the increment helper. */
  _incrementInstallCount?: (slug: string) => Promise<number | null>;
}

/**
 * Install a marketplace template into the caller's workspace.
 *
 * Returns a discriminated union; the API route layer maps the union
 * onto HTTP status codes (404 for `not_found`, 200 for the others).
 */
export async function installMarketplaceTemplate(
  opts: InstallTemplateOptions,
): Promise<InstallTemplateResult> {
  const {
    templateSlug,
    userId,
    workspaceId = userId,
    performWrite = true,
  } = opts;

  if (!templateSlug) throw new Error('installMarketplaceTemplate: templateSlug is required');
  if (!userId) throw new Error('installMarketplaceTemplate: userId is required');

  /* ── 1. Look up the template ──────────────────────────────────────── */
  const lookup = opts._lookupTemplate ?? getMarketplaceTemplate;
  const template = await lookup(templateSlug);
  if (!template) return { status: 'not_found' };

  /* ── 2. Cross-check required credentials ──────────────────────────── */
  const required = dedupeCredTypes(template.requiredCredentials ?? []);
  const ownedTypes = await (
    opts._listOwnedTypes ?? defaultListOwnedTypes
  )(workspaceId);

  const missing = required.filter((t) => !ownedTypes.has(t));
  if (missing.length > 0) {
    return {
      status: 'needs_credentials',
      missing,
      required,
      templateSlug,
    };
  }

  if (!performWrite) {
    // Caller asked for a dry-run preview (modal-time check).
    return {
      status: 'ok',
      flowId: '',
      editorUrl: '',
      installCount: null,
    };
  }

  /* ── 3. Clone the flow into `sabflows` ────────────────────────────── */
  const cloned = remapFlowIds(template.flow);
  const now = new Date();
  const _id = new ObjectId();
  const doc: SabFlowDoc = {
    _id,
    userId,
    name: cloned.name,
    events: cloned.events,
    groups: cloned.groups,
    edges: cloned.edges,
    variables: cloned.variables,
    annotations: [],
    theme: cloned.theme ?? {},
    settings: {
      ...(cloned.settings ?? {}),
      marketplaceSource: {
        slug: template.slug,
        installedAt: now.toISOString(),
      },
    },
    status: 'DRAFT',
    createdAt: now,
    updatedAt: now,
  } as SabFlowDoc;

  const col = await getSabFlowCollection();
  await col.insertOne(doc);

  /* ── 4. Bump install count (best-effort, never blocks install) ─────── */
  const inc = opts._incrementInstallCount ?? incrementInstallCount;
  let installCount: number | null = null;
  try {
    installCount = await inc(template.slug);
  } catch (err) {
    console.error('[sabflow/marketplace/install] incrementInstallCount failed:', err);
  }

  return {
    status: 'ok',
    flowId: _id.toHexString(),
    editorUrl: `/dashboard/sabflow/flow-builder/${_id.toHexString()}`,
    installCount,
  };
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function dedupeCredTypes(list: CredentialType[]): CredentialType[] {
  const seen = new Set<CredentialType>();
  const out: CredentialType[] = [];
  for (const t of list) {
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Default credential-type lister — pulls every credential row owned by the
 * workspace and projects it down to the distinct set of types. We
 * intentionally do NOT inspect individual credential `data` here; the
 * install gate is "do you have *any* credential of type X?" which mirrors
 * the executor's per-block credential resolution: the user picks which
 * specific row to bind once the flow is in the editor.
 *
 * See `executor/credentials/import-n8n.ts` for the matching philosophy on
 * the inverse flow (importing credential rows themselves).
 */
async function defaultListOwnedTypes(
  workspaceId: string,
): Promise<Set<CredentialType>> {
  const rows = await getCredentials(workspaceId);
  const set = new Set<CredentialType>();
  for (const r of rows) set.add(r.type);
  return set;
}

/* ── Flow-id remapping (mirrors Phase B.5 §9 import path) ───────────────── */

/**
 * Re-generate every id inside the flow body so the cloned row doesn't
 * collide with the marketplace source (or any prior install of the same
 * template). Mirrors `src/app/api/sabflow/import/route.ts:remapIds()` so
 * marketplace installs and JSON imports converge on identical semantics.
 *
 * Exported for unit testing.
 */
export function remapFlowIds(flow: MarketplaceTemplateFlow): MarketplaceTemplateFlow {
  const idMap = new Map<string, string>();
  const newId = (old: string | undefined): string => {
    if (!old) return createId();
    if (!idMap.has(old)) idMap.set(old, createId());
    return idMap.get(old)!;
  };

  const events: SabFlowEvent[] = (flow.events ?? []).map((ev) => ({
    ...ev,
    id: newId(ev.id),
    outgoingEdgeId: ev.outgoingEdgeId ? newId(ev.outgoingEdgeId) : undefined,
  }));

  const groups: Group[] = (flow.groups ?? []).map((g) => ({
    ...g,
    id: newId(g.id),
    blocks: (g.blocks ?? []).map((b) => ({
      ...b,
      id: newId(b.id),
      groupId: newId(b.groupId),
      outgoingEdgeId: b.outgoingEdgeId ? newId(b.outgoingEdgeId) : undefined,
      items: (b.items ?? []).map((item) => ({
        ...item,
        id: newId(item.id),
        blockId: item.blockId ? newId(item.blockId) : undefined,
        outgoingEdgeId: item.outgoingEdgeId
          ? newId(item.outgoingEdgeId)
          : undefined,
      })),
    })),
  }));

  const edges: Edge[] = (flow.edges ?? []).map((e) => {
    const from = { ...e.from } as Edge['from'];
    if ('eventId' in from && (from as { eventId?: string }).eventId) {
      (from as { eventId: string }).eventId = newId(
        (from as { eventId: string }).eventId,
      );
    }
    if ('groupId' in from && (from as { groupId?: string }).groupId) {
      (from as { groupId: string }).groupId = newId(
        (from as { groupId: string }).groupId,
      );
    }
    if ('blockId' in from && (from as { blockId?: string }).blockId) {
      (from as { blockId: string }).blockId = newId(
        (from as { blockId: string }).blockId,
      );
    }
    if ('itemId' in from && (from as { itemId?: string }).itemId) {
      (from as { itemId: string }).itemId = newId(
        (from as { itemId: string }).itemId,
      );
    }
    return {
      ...e,
      id: newId(e.id),
      from,
      to: {
        groupId: newId(e.to.groupId),
        blockId: e.to.blockId ? newId(e.to.blockId) : undefined,
      },
    };
  });

  const variables: Variable[] = (flow.variables ?? []).map((v) => ({
    ...v,
    id: newId(v.id),
  }));

  return {
    name: flow.name ?? 'Marketplace template',
    events,
    groups,
    edges,
    variables,
    theme: flow.theme ?? {},
    settings: flow.settings ?? {},
  };
}
