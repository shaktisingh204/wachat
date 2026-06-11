'use client';

/**
 * useAppCatalog — client-side merge of every executable app the SabFlow
 * editor can place: native static blocks, Rust descriptor nodes, forge
 * blocks, and app presets. See `./types.ts` for the contract.
 *
 * Each remote source is fetched once per session via module-level caches
 * (descriptors reuse descriptorRegistry's cache, presets reuse
 * app-presets/client's cache, forge summaries cache here).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  LuActivity,
  LuBox,
  LuBrain,
  LuChartBar,
  LuClock,
  LuCloud,
  LuCode,
  LuCreditCard,
  LuDatabase,
  LuFileText,
  LuGlobe,
  LuLayers,
  LuMail,
  LuMessageSquare,
  LuPackage,
  LuPhone,
  LuPlug,
  LuSquareCheck,
  LuUsers,
  LuVideo,
  LuZap,
} from 'react-icons/lu';
import {
  fetchDescriptors,
  iconForDescriptor,
  type FetchedDescriptor,
} from '@/components/sabflow/editor/descriptorRegistry';
import { blockRegistry } from '@/components/sabflow/editor/blockRegistry';
import { fetchPresetSummaries } from '@/lib/sabflow/app-presets/client';
import type { AppPresetSummary } from '@/lib/sabflow/app-presets/types';
import { getBlockBrandIcon, getBrandIconForSlug } from '@/lib/sabflow/blocks/icons';
import type { BlockType } from '@/lib/sabflow/types';
import type {
  AppCatalogCounts,
  AppCatalogEntry,
  AppCatalogIcon,
  UseAppCatalogResult,
} from './types';

export type {
  AppCatalogBackend,
  AppCatalogCounts,
  AppCatalogEntry,
  AppCatalogIcon,
  AppCatalogKind,
  UseAppCatalogResult,
} from './types';

/* ── Slug normalizer ──────────────────────────────────────────────────────── */

/**
 * Normalize an id/type into the catalog dedupe slug:
 *   lowercase → strip leading `n8n-` / `forge_` → strip `[-_.\s]` →
 *   strip trailing `v<N>`. Trigger suffixes are KEPT so `webflow_trigger`
 *   stays distinct from `webflow`.
 *
 * Examples: `open_ai` → `openai`, `forge_google_sheets` → `googlesheets`,
 * `n8n-cal-com` → `calcom`, `forge_slack_v1` → `slack`.
 */
export function normalizeAppSlug(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^n8n[-_.\s]+/, '');
  s = s.replace(/^forge[-_.\s]+/, '');
  s = s.replace(/[-_.\s]+/g, '');
  s = s.replace(/v\d+$/, '');
  return s;
}

/* ── Category labels ──────────────────────────────────────────────────────── */

const CATEGORY_LABELS: Record<string, string> = {
  communication: 'Communication',
  productivity: 'Productivity',
  crm: 'CRM',
  sales: 'Sales',
  marketing: 'Marketing',
  finance: 'Finance',
  storage: 'Storage',
  files: 'Files',
  database: 'Databases',
  databases: 'Databases',
  analytics: 'Analytics',
  ai: 'AI',
  developer: 'Developer',
  devtools: 'Developer',
  hr: 'HR',
  action: 'Actions',
  trigger: 'Triggers',
  logic: 'Logic',
  transform: 'Transform',
  integration: 'Integrations',
  integrations: 'Integrations',
  ecommerce: 'E-commerce',
  'e-commerce': 'E-commerce',
  misc: 'Miscellaneous',
};

function categoryLabel(raw: string | undefined): string {
  const key = (raw ?? '').trim().toLowerCase();
  if (!key) return 'Miscellaneous';
  return CATEGORY_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/* ── Fallback lucide icons for forge/preset entries ───────────────────────── */

// Forge blocks + presets declare a react-icons/lu name (e.g. `LuVideo`).
// We resolve the common ones from a curated map (importing the whole
// react-icons/lu barrel would bloat the bundle); anything unmapped falls
// back to a category icon, then LuPlug. Brand icons cover most visuals.
const LU_NAME_MAP: Record<string, AppCatalogIcon> = {
  LuActivity: LuActivity as AppCatalogIcon,
  LuBox: LuBox as AppCatalogIcon,
  LuBrain: LuBrain as AppCatalogIcon,
  LuChartBar: LuChartBar as AppCatalogIcon,
  LuClock: LuClock as AppCatalogIcon,
  LuCloud: LuCloud as AppCatalogIcon,
  LuCode: LuCode as AppCatalogIcon,
  LuCreditCard: LuCreditCard as AppCatalogIcon,
  LuDatabase: LuDatabase as AppCatalogIcon,
  LuFileText: LuFileText as AppCatalogIcon,
  LuGlobe: LuGlobe as AppCatalogIcon,
  LuLayers: LuLayers as AppCatalogIcon,
  LuMail: LuMail as AppCatalogIcon,
  LuMessageSquare: LuMessageSquare as AppCatalogIcon,
  LuPackage: LuPackage as AppCatalogIcon,
  LuPhone: LuPhone as AppCatalogIcon,
  LuSquareCheck: LuSquareCheck as AppCatalogIcon,
  LuUsers: LuUsers as AppCatalogIcon,
  LuVideo: LuVideo as AppCatalogIcon,
  LuZap: LuZap as AppCatalogIcon,
};

const CATEGORY_ICONS: Record<string, AppCatalogIcon> = {
  communication: LuMessageSquare as AppCatalogIcon,
  productivity: LuSquareCheck as AppCatalogIcon,
  crm: LuUsers as AppCatalogIcon,
  sales: LuUsers as AppCatalogIcon,
  marketing: LuMail as AppCatalogIcon,
  finance: LuCreditCard as AppCatalogIcon,
  storage: LuCloud as AppCatalogIcon,
  files: LuFileText as AppCatalogIcon,
  database: LuDatabase as AppCatalogIcon,
  databases: LuDatabase as AppCatalogIcon,
  analytics: LuChartBar as AppCatalogIcon,
  ai: LuBrain as AppCatalogIcon,
  developer: LuCode as AppCatalogIcon,
  hr: LuUsers as AppCatalogIcon,
  integration: LuPlug as AppCatalogIcon,
  integrations: LuPlug as AppCatalogIcon,
};

const DEFAULT_ICON = LuPlug as AppCatalogIcon;

function iconForApp(iconName: string | undefined, category: string | undefined): AppCatalogIcon {
  if (iconName && LU_NAME_MAP[iconName]) return LU_NAME_MAP[iconName];
  const key = (category ?? '').trim().toLowerCase();
  return CATEGORY_ICONS[key] ?? DEFAULT_ICON;
}

/* ── Forge summaries (module-level cache) ─────────────────────────────────── */

export type ForgeBlockSummary = {
  id: string;
  name: string;
  description?: string;
  iconName?: string;
  iconUrl?: string;
  category?: string;
};

let _forgeCache: ForgeBlockSummary[] | null = null;
let _forgeInflight: Promise<ForgeBlockSummary[]> | null = null;

async function fetchForgeSummaries(): Promise<ForgeBlockSummary[]> {
  if (_forgeCache) return _forgeCache;
  if (_forgeInflight) return _forgeInflight;
  _forgeInflight = fetch('/api/sabflow/forge-metadata?summary=1', { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`forge-metadata summary: ${res.status}`);
      const json = (await res.json()) as { blocks?: Record<string, ForgeBlockSummary> };
      _forgeCache = Object.values(json.blocks ?? {});
      return _forgeCache;
    })
    .finally(() => {
      _forgeInflight = null;
    });
  return _forgeInflight;
}

/* ── Catalog build ────────────────────────────────────────────────────────── */

const CORE_CATEGORIES = new Set(['bubbles', 'inputs', 'logic']);

const NATIVE_CATEGORY_LABEL: Record<string, string> = {
  bubbles: 'Bubbles',
  inputs: 'Inputs',
  logic: 'Logic',
  integrations: 'Integrations',
  forge: 'Integrations',
};

function buildCatalog(
  descriptors: FetchedDescriptor[],
  forgeBlocks: ForgeBlockSummary[],
  presets: AppPresetSummary[],
): { entries: AppCatalogEntry[]; appCount: number; counts: AppCatalogCounts } {
  const core: AppCatalogEntry[] = [];
  // Slug → entry. Insertion order encodes precedence: native → rust → forge → preset.
  const apps = new Map<string, AppCatalogEntry>();

  /* 1. Native static blocks (editor blockRegistry). */
  for (const e of blockRegistry) {
    const slug = normalizeAppSlug(e.type);
    const isCore = CORE_CATEGORIES.has(e.category);
    const entry: AppCatalogEntry = {
      key: e.type,
      slug,
      label: e.label,
      description: e.description,
      category: NATIVE_CATEGORY_LABEL[e.category] ?? categoryLabel(e.category),
      icon: e.icon as AppCatalogIcon,
      brandIcon: getBlockBrandIcon(e.type) ?? undefined,
      color: e.color,
      backend: 'native',
      blockType: e.type,
      kind: isCore ? 'core' : 'action',
    };
    if (isCore) {
      core.push(entry);
    } else if (!apps.has(slug)) {
      apps.set(slug, entry);
    }
  }
  // Core types still shadow same-slug app entries (e.g. native `merge` vs a
  // rust `merge` node) — record their slugs so lower backends can't re-add them.
  const coreSlugs = new Set(core.map((e) => e.slug));

  /* 2. Rust descriptor nodes. */
  for (const d of descriptors) {
    if (d.stub) continue; // defensive — only executable nodes
    const slug = normalizeAppSlug(d.name);
    if (apps.has(slug) || coreSlugs.has(slug)) continue;
    apps.set(slug, {
      key: d.name,
      slug,
      label: d.displayName,
      description: d.description,
      category: categoryLabel(d.category),
      icon: iconForDescriptor(d.icon),
      brandIcon:
        getBlockBrandIcon(d.name) ?? getBrandIconForSlug(slug) ?? undefined,
      color: d.color || '#94a3b8',
      backend: 'rust',
      blockType: d.name as BlockType,
      kind: d.isTrigger ? 'trigger' : 'action',
    });
  }

  /* 3. Forge blocks. */
  for (const b of forgeBlocks) {
    if (b.id === 'forge_app_preset') continue; // dispatcher, surfaced via presets
    const slug = normalizeAppSlug(b.id);
    if (apps.has(slug) || coreSlugs.has(slug)) continue;
    apps.set(slug, {
      key: b.id,
      slug,
      label: b.name,
      description: b.description ?? '',
      category: categoryLabel(b.category),
      icon: iconForApp(b.iconName, b.category),
      brandIcon:
        getBlockBrandIcon(b.id) ?? getBrandIconForSlug(slug) ?? undefined,
      color: '#a855f7',
      backend: 'forge',
      blockType: b.id as BlockType,
      kind: /_trigger$/.test(b.id) ? 'trigger' : 'action',
    });
  }

  /* 4. App presets — executed via the `forge_app_preset` dispatcher. */
  for (const p of presets) {
    const slug = normalizeAppSlug(p.id);
    if (apps.has(slug) || coreSlugs.has(slug)) continue;
    // P1 may gate the listing / add a `draft` flag — consume defensively.
    const draft =
      (p as { draft?: boolean }).draft === true || p.status === 'draft';
    apps.set(slug, {
      key: `forge_app_preset:${p.id}`,
      slug,
      label: p.name,
      description:
        typeof p.endpointCount === 'number' && p.endpointCount > 0
          ? `${p.endpointCount} action${p.endpointCount === 1 ? '' : 's'}`
          : 'App preset integration',
      category: categoryLabel(p.category),
      icon: iconForApp(p.iconName, p.category),
      brandIcon: getBrandIconForSlug(slug) ?? undefined,
      color: '#0ea5e9',
      backend: 'preset',
      blockType: 'forge_app_preset' as BlockType,
      defaultOptions: { presetId: p.id, __label: p.name, inputs: {} },
      kind: 'action',
      draft: draft || undefined,
    });
  }

  const appEntries = [...apps.values()];
  const counts: AppCatalogCounts = { native: 0, rust: 0, forge: 0, preset: 0 };
  for (const e of appEntries) counts[e.backend] += 1;

  return {
    entries: [...core, ...appEntries],
    appCount: appEntries.length,
    counts,
  };
}

/* ── Hook ─────────────────────────────────────────────────────────────────── */

export function useAppCatalog(): UseAppCatalogResult {
  const [descriptors, setDescriptors] = useState<FetchedDescriptor[] | null>(null);
  const [forgeBlocks, setForgeBlocks] = useState<ForgeBlockSummary[] | null>(null);
  const [presets, setPresets] = useState<AppPresetSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDescriptors()
      .then((d) => !cancelled && setDescriptors(d))
      .catch(() => !cancelled && setDescriptors([]));
    fetchForgeSummaries()
      .then((f) => !cancelled && setForgeBlocks(f))
      .catch(() => !cancelled && setForgeBlocks([]));
    fetchPresetSummaries()
      .then((p) => !cancelled && setPresets(p))
      .catch(() => !cancelled && setPresets([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = descriptors === null || forgeBlocks === null || presets === null;

  return useMemo(() => {
    const { entries, appCount, counts } = buildCatalog(
      descriptors ?? [],
      forgeBlocks ?? [],
      presets ?? [],
    );
    return { entries, appCount, counts, loading };
  }, [descriptors, forgeBlocks, presets, loading]);
}
