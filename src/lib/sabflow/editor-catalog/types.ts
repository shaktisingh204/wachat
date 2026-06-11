/**
 * SabFlow editor catalog — unified app/block catalog types.
 *
 * One entry per executable thing the editor can place on the canvas,
 * merged from four backends:
 *   - 'native'  — hand-written static blocks (editor blockRegistry.ts)
 *   - 'rust'    — Rust `sabflow-nodes` descriptors (/api/sabflow/nodes)
 *   - 'forge'   — declarative forge blocks (/api/sabflow/forge-metadata)
 *   - 'preset'  — app-preset JSONs executed via the `forge_app_preset`
 *                 dispatcher (/api/sabflow/app-presets)
 *
 * Entries are deduped by a normalized `slug` with precedence
 * native > rust > forge > preset.
 */

import type { ComponentType, SVGProps } from 'react';
import type { BlockType } from '@/lib/sabflow/types';

export type AppCatalogBackend = 'native' | 'rust' | 'forge' | 'preset';

/**
 * 'core' — platform primitives (bubbles / inputs / logic). Rendered in their
 *          own palette sections and excluded from the slug dedupe.
 * 'trigger' / 'action' — app entries shown in the "Apps" super-section.
 */
export type AppCatalogKind = 'core' | 'action' | 'trigger';

export type AppCatalogIcon = ComponentType<
  SVGProps<SVGSVGElement> & { className?: string }
>;

export type AppCatalogEntry = {
  /** Unique within the catalog: the blockType, or `forge_app_preset:<presetId>`. */
  key: string;
  /** Normalized dedupe key — see `normalizeAppSlug`. */
  slug: string;
  label: string;
  description: string;
  /** Human-readable category label used for grouping (e.g. "Communication"). */
  category: string;
  /** Lucide-style fallback icon component (react-icons/lu). */
  icon: AppCatalogIcon;
  /**
   * Optional iconify name (`logos:*` / `simple-icons:*` / `mdi:*`). May be
   * speculative — render with a fallback to `icon`.
   */
  brandIcon?: string;
  /** Tint color for the fallback icon tile. */
  color: string;
  backend: AppCatalogBackend;
  /** The block `type` to create on the canvas. */
  blockType: BlockType;
  /** Options to seed the created block with (e.g. `{ presetId, __label }`). */
  defaultOptions?: Record<string, unknown>;
  kind: AppCatalogKind;
  /** True for auto-imported presets not yet hand-verified. */
  draft?: boolean;
};

export type AppCatalogCounts = {
  native: number;
  rust: number;
  forge: number;
  preset: number;
};

export type UseAppCatalogResult = {
  /** Every catalog entry (core + apps), deduped. */
  entries: AppCatalogEntry[];
  /** Number of app entries (kind !== 'core') after dedupe. */
  appCount: number;
  /** Per-backend app counts after dedupe (kind !== 'core'). */
  counts: AppCatalogCounts;
  /** True while any of the three remote sources is still loading. */
  loading: boolean;
};
