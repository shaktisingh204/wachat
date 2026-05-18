/**
 * SabFlow Marketplace — unified template registry (Phase C.10.8 #8).
 *
 * Until now SabFlow shipped **two parallel, code-defined template registries**
 * with mutually-exclusive category enums:
 *
 *  - `src/components/sabflow/templates/`  — 19 "Typebot-style" chatbot flows
 *    consumed by the in-builder `TemplatesSheet` picker. Carries icon / emoji
 *    / color metadata + a `build(): TemplateInstance` factory that hydrates a
 *    fresh graph with new ids each call.
 *
 *  - `src/lib/sabflow/recipes/`          — ~105 "n8n-style" workflow recipes
 *    consumed only via the `/api/sabflow/recipes` HTTP endpoint today. Pure
 *    declarative data — instantiated by `instantiateRecipe()` which rekeys
 *    every block/group/edge id at the registry layer.
 *
 * This module unifies both surfaces behind a single `Template` shape and a
 * single `MarketplaceRegistry` so the in-builder picker, the marketplace
 * browse page (Phase C.10.5), the install API, and future telemetry all
 * read from one source of truth.
 *
 * Design notes
 * ────────────
 *  - **No breaking changes.** The legacy entry points (`@/components/sabflow/
 *    templates` and `@/lib/sabflow/recipes`) keep their public surface and now
 *    delegate here.
 *  - **Lazy population.** The chatbot definitions live under `src/components/`
 *    so they pull React icon components. Importing them here unconditionally
 *    would drag JSX into server-only code paths that only want the recipes.
 *    Both sides instead call `registerTemplate()` at their own module-init
 *    time; this file just holds the storage + the canonical `Template` shape.
 *  - **Canonical categories.** We map both legacy enums onto the C.10.5
 *    target taxonomy. The legacy values keep working — `normaliseCategory()`
 *    is exposed so consumers that read the raw `category` field still get a
 *    valid `TemplateCategory`.
 *  - **Versioning.** Every template gets `version: '1.0.0'` by default so
 *    the C.10.4 upgrade-diff UI has something to render from day one.
 *  - **Telemetry-friendly.** `installCount` starts at 0; Mongo-backed
 *    increments (Phase C.10.10) plug into the same field.
 */

import type {
  Block,
  Edge,
  Group,
  SabFlowDoc,
  SabFlowEvent,
  SabFlowTheme,
  Variable,
} from '@/lib/sabflow/types';

/* ── Canonical category taxonomy (C.10.5) ────────────────── */

/**
 * The single source-of-truth category list.  Derived from the
 * Phase C.10.5 brief, padded with the buckets both legacy registries actually
 * used so no existing template loses its bucket.
 */
export type TemplateCategory =
  | 'Sales'
  | 'Marketing'
  | 'Support'
  | 'Ops'
  | 'AI'
  | 'Internal Tools'
  | 'Developer'
  | 'E-commerce'
  | 'Finance'
  | 'HR'
  | 'Health'
  | 'WhatsApp'
  | 'Ads'
  | 'CRM'
  | 'Onboarding'
  | 'Other';

/**
 * Ordered display list used by filter chips.  `'Other'` is appended last so
 * legacy / un-categorised templates don't muddy the prime real-estate.
 */
export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'Sales',
  'Marketing',
  'Support',
  'Ops',
  'AI',
  'Internal Tools',
  'Developer',
  'CRM',
  'E-commerce',
  'Finance',
  'HR',
  'Health',
  'WhatsApp',
  'Ads',
  'Onboarding',
  'Other',
];

/* ── Legacy category mappings ────────────────────────────── */

/**
 * Chatbot registry category labels → canonical bucket.
 *
 * Source enum: `'Marketing' | 'Support' | 'Sales' | 'HR' | 'E-commerce'
 *               | 'Health' | 'Other'`  (see `src/components/sabflow/templates/types.ts`).
 */
const CHATBOT_CATEGORY_MAP: Record<string, TemplateCategory> = {
  Marketing: 'Marketing',
  Support: 'Support',
  Sales: 'Sales',
  HR: 'HR',
  'E-commerce': 'E-commerce',
  Health: 'Health',
  Other: 'Other',
};

/**
 * Recipe registry category labels → canonical bucket.
 *
 * Source enum: `'sales' | 'marketing' | 'support' | 'ops' | 'finance' | 'crm'
 *               | 'whatsapp' | 'ecommerce' | 'ads' | 'onboarding'`
 *               (see `src/lib/sabflow/recipes/types.ts`).
 */
const RECIPE_CATEGORY_MAP: Record<string, TemplateCategory> = {
  sales: 'Sales',
  marketing: 'Marketing',
  support: 'Support',
  ops: 'Ops',
  finance: 'Finance',
  crm: 'CRM',
  whatsapp: 'WhatsApp',
  ecommerce: 'E-commerce',
  ads: 'Ads',
  onboarding: 'Onboarding',
};

/**
 * Coerce any legacy category label into a canonical `TemplateCategory`.
 * Unknown labels (e.g. partner-submitted templates with a free-form
 * category) fall back to `'Other'` — consumers should never see a
 * non-canonical value when they read `template.category`.
 */
export function normaliseCategory(raw: string): TemplateCategory {
  if (raw in CHATBOT_CATEGORY_MAP) return CHATBOT_CATEGORY_MAP[raw];
  if (raw in RECIPE_CATEGORY_MAP) return RECIPE_CATEGORY_MAP[raw];
  // Already-canonical values pass through (string-typed catalogue rows).
  if ((TEMPLATE_CATEGORIES as string[]).includes(raw)) {
    return raw as TemplateCategory;
  }
  return 'Other';
}

/* ── Canonical Template shape ────────────────────────────── */

/**
 * Output of a chatbot template's `build()` call — a fresh graph ready to be
 * persisted via `saveSabFlow()`.  Kept structurally compatible with the
 * legacy `TemplateInstance` so existing call-sites work unchanged.
 */
export type TemplateInstance = {
  groups: Group[];
  edges: Edge[];
  variables: Variable[];
  events: SabFlowEvent[];
  theme: SabFlowTheme;
  settings: Record<string, unknown>;
};

/**
 * Static metadata for a template publisher.  First-party templates use a
 * fixed `'sabnode'` publisher; partner submissions (Phase C.10.9) carry the
 * partner's id here.
 */
export type TemplatePublisher = {
  /** Stable id, e.g. `'sabnode'`, `'acme-partner'`. */
  id: string;
  /** Display name. */
  name: string;
  /** Optional verification flag (admin-set). */
  verified?: boolean;
};

/** Cosmetic metadata used by the chatbot-style card UI. */
export type TemplateChrome = {
  emoji: string;
  color: string;
  bgColor: string;
  /** React icon component — kept as `unknown` to avoid pulling JSX types
   *  into server-only consumers; the chatbot picker re-casts it back. */
  icon?: unknown;
};

/**
 * Canonical template record consumed by:
 *  - in-builder picker (`TemplatesSheet`)
 *  - marketplace browse page (Phase C.10.5)
 *  - install API (`/api/sabflow/recipes`)
 *  - admin review queue (Phase C.10.3)
 *  - telemetry rollups (Phase C.10.10)
 */
export type Template = {
  /** Stable id, preserved from the legacy registries verbatim. */
  id: string;
  /** URL-safe slug.  Defaults to `id` (the legacy ids are already slug-safe). */
  slug: string;
  /** Display name (formerly `name`). */
  displayName: string;
  /** Short marketing-style description (1–3 sentences). */
  description: string;
  /** Canonical category — normalised at registration time. */
  category: TemplateCategory;
  /** Free-form labels for search / filter. */
  tags: string[];
  /**
   * Credential ids this template needs at install time.  Auto-extracted from
   * recipe blocks when `kind === 'recipe'`; hand-declared (defaults to empty)
   * for chatbot templates.  Powers the "works with my workspace" badge
   * (C.10.5).
   */
  requiredCredentials: string[];
  /** Cover/preview screenshots — empty by default, filled by C.10.8 curation. */
  screenshots: string[];
  /** Semver — every existing template gets `'1.0.0'`. */
  version: string;
  /** Publisher metadata. */
  publisher: TemplatePublisher;
  /** Cumulative install counter (mirrored on the Mongo doc once C.10.9 lands). */
  installCount: number;

  /**
   * Discriminator between the two graph shapes:
   *  - `'chatbot'` — graph is materialised on demand via `build()`.  Used by
   *    the in-builder picker which needs fresh ids per click.
   *  - `'recipe'` — graph is declared as flat block/variable arrays, then
   *    rekeyed by the registry's `instantiateForTenant()` helper at install
   *    time (same logic as the legacy `instantiateRecipe`).
   */
  kind: 'chatbot' | 'recipe';

  /** Cosmetic chrome (chatbot picker uses it; marketplace browse falls back). */
  chrome?: TemplateChrome;

  /**
   * Chatbot-only — returns a fresh `TemplateInstance` with new ids on every
   * call.  Present when `kind === 'chatbot'`.
   */
  build?: () => TemplateInstance;

  /**
   * Recipe-only — pure data describing the trigger + blocks + variables.
   * Present when `kind === 'recipe'`.
   */
  flow?: {
    trigger: SabFlowEvent;
    blocks: Block[];
    variables: Variable[];
  };
};

/* ── Registry storage ────────────────────────────────────── */

const templateMap = new Map<string, Template>();

/** Register a template.  Re-registering the same id silently overwrites — same
 *  semantics as the legacy `registerRecipe` so the existing seed-pack files
 *  keep working unchanged. */
export function registerTemplate(template: Template): void {
  templateMap.set(template.id, template);
}

/** Returns every registered template in insertion order. */
export function listTemplates(): Template[] {
  return Array.from(templateMap.values());
}

/** Returns a template by id, or `undefined` if absent. */
export function getTemplate(id: string): Template | undefined {
  return templateMap.get(id);
}

/** Returns every template in the given category. */
export function listTemplatesByCategory(
  category: TemplateCategory,
): Template[] {
  const out: Template[] = [];
  for (const t of templateMap.values()) {
    if (t.category === category) out.push(t);
  }
  return out;
}

/** Filter helper for the in-builder picker — chatbot kind only. */
export function listChatbotTemplates(): Template[] {
  return Array.from(templateMap.values()).filter((t) => t.kind === 'chatbot');
}

/** Filter helper for the marketplace browse page — recipe kind only. */
export function listRecipeTemplates(): Template[] {
  return Array.from(templateMap.values()).filter((t) => t.kind === 'recipe');
}

/* ── Instantiation helpers ───────────────────────────────── */

/**
 * Generates a short random id suffix.  Templates intentionally use stable
 * ids inside their definition so we can freely re-clone them — but every
 * instantiation needs *fresh* block/group/edge ids so two flows built from
 * the same template don't collide in storage.
 *
 * Lifted verbatim from `recipes/registry.ts` so the cloning semantics stay
 * identical and the existing fixtures keep working.
 */
function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function layoutCoords(index: number): { x: number; y: number } {
  return { x: 200 + index * 320, y: 200 };
}

/**
 * Materialise a recipe-kind template into a `SabFlowDoc` for the given
 * tenant.  Identical to the legacy `instantiateRecipe()` but keyed off the
 * unified registry so the install API stays single-source.
 *
 * Returns `null` when the template is missing or is a chatbot template
 * (chatbot graphs are materialised via `template.build()` + `saveSabFlow()`
 * inside the picker UI; see `TemplatesSheet.handleSelect`).
 */
export function instantiateRecipeTemplate(
  templateId: string,
  tenantId: string,
): SabFlowDoc | null {
  const template = templateMap.get(templateId);
  if (!template || template.kind !== 'recipe' || !template.flow) return null;

  const { trigger, blocks: recipeBlocks, variables } = template.flow;

  const groupIdMap = new Map<string, string>();
  const blockIdMap = new Map<string, string>();
  const orderedGroupIds: string[] = [];
  for (const block of recipeBlocks) {
    if (!groupIdMap.has(block.groupId)) {
      const newId = `g_${shortId()}`;
      groupIdMap.set(block.groupId, newId);
      orderedGroupIds.push(block.groupId);
    }
  }

  const groups: Group[] = orderedGroupIds.map((oldId, idx) => {
    const newGroupId = groupIdMap.get(oldId)!;
    const blocks: Block[] = recipeBlocks
      .filter((b) => b.groupId === oldId)
      .map((b) => {
        const newBlockId = `b_${shortId()}`;
        blockIdMap.set(b.id, newBlockId);
        return {
          ...b,
          id: newBlockId,
          groupId: newGroupId,
        } as Block;
      });

    return {
      id: newGroupId,
      title: `Step ${idx + 1}`,
      graphCoordinates: layoutCoords(idx),
      blocks,
    };
  });

  const edges: Edge[] = [];
  for (let i = 0; i < orderedGroupIds.length - 1; i++) {
    const fromGroupId = groupIdMap.get(orderedGroupIds[i])!;
    const toGroupId = groupIdMap.get(orderedGroupIds[i + 1])!;
    edges.push({
      id: `e_${shortId()}`,
      from: { groupId: fromGroupId },
      to: { groupId: toGroupId },
    });
  }

  const newTriggerId = `t_${shortId()}`;
  const triggerCloned: SabFlowEvent = {
    ...trigger,
    id: newTriggerId,
    graphCoordinates: { x: 80, y: 200 },
  };
  if (orderedGroupIds.length > 0) {
    const firstGroupId = groupIdMap.get(orderedGroupIds[0])!;
    edges.unshift({
      id: `e_${shortId()}`,
      from: { eventId: newTriggerId },
      to: { groupId: firstGroupId },
    });
  }

  const now = new Date();
  const doc: SabFlowDoc = {
    userId: tenantId,
    name: template.displayName,
    events: [triggerCloned],
    groups,
    edges,
    variables: variables.map((v) => ({ ...v })),
    annotations: [],
    theme: {},
    settings: {
      description: template.description,
    },
    status: 'DRAFT',
    createdAt: now,
    updatedAt: now,
  };

  return doc;
}

/* ── First-party publisher constant ──────────────────────── */

export const FIRST_PARTY_PUBLISHER: TemplatePublisher = {
  id: 'sabnode',
  name: 'SabNode',
  verified: true,
};

/* ── Required-credential extraction ──────────────────────── */

/**
 * Auto-extract credential ids referenced by a recipe's blocks.
 * Walks `forge_*` block options for an explicit `credentialId` (the
 * Phase B.5 credential picker writes that field on every saved block).
 *
 * Returns an empty array when no credentials are referenced — the common
 * case today since most seed recipes embed credential placeholders as
 * `{{variable}}` strings rather than real credential refs.
 */
export function extractRequiredCredentials(blocks: Block[]): string[] {
  const ids = new Set<string>();
  for (const b of blocks) {
    const opts = (b as { options?: Record<string, unknown> }).options;
    if (!opts) continue;
    const credId = opts['credentialId'];
    if (typeof credId === 'string' && credId.length > 0) {
      ids.add(credId);
    }
  }
  return Array.from(ids);
}
