/**
 * SabFlow Marketplace — template repository.
 *
 * Phase C.10 — Workflow templates marketplace.
 *
 * This module is the **forward-declared** data layer for the marketplace
 * templates collection (`sabflow_marketplace_templates`). Sibling sub-tasks
 * own the publish / list / rating endpoints; this file exposes only the
 * minimum surface the install path (sub-task #6) needs:
 *
 *   - `getMarketplaceTemplate(slug)` → fetches a single published template.
 *   - `incrementInstallCount(slug)`  → bumps `installCount` atomically.
 *
 * The collection shape mirrors `docs/ecosystem/slices/05-sabflow-expansion.md`
 * §31: a public registry shard backed by Mongo with author + rating fields.
 * Each row is a complete, ready-to-clone SabFlow document plus marketplace
 * metadata (slug, requiredCredentials, installCount, ...).
 *
 * Cross-tenant safety: marketplace templates are **public-by-design** — once
 * published they're visible to every workspace. The install path stamps the
 * cloned doc with the installer's `userId`, so per-tenant isolation lives
 * inside the install helper, not here.
 */

import 'server-only';

import { type Collection } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import type {
  SabFlowDoc,
  Group,
  Edge,
  SabFlowEvent,
  Variable,
  SabFlowTheme,
} from '@/lib/sabflow/types';
import type { CredentialType } from '@/lib/sabflow/credentials/types';

/* ── Constants ─────────────────────────────────────────────────────────── */

/** Mongo collection name. Single source of truth — do not inline elsewhere. */
export const SABFLOW_MARKETPLACE_TEMPLATES_COLLECTION =
  'sabflow_marketplace_templates';

/* ── Types ─────────────────────────────────────────────────────────────── */

/**
 * The trimmed-down flow body stored on every marketplace row.
 *
 * Marketplace rows are **id-less templates** — every block / group / edge id
 * is regenerated when the row is cloned into a workspace (see
 * `cloneTemplateFlow` in `./install.ts`). We store the shape that the
 * Phase B.5 §9 import path consumes (`/api/sabflow/import` → `remapIds()`)
 * so the install code path is just "fetch + remap + insert".
 */
export interface MarketplaceTemplateFlow {
  name: string;
  events: SabFlowEvent[];
  groups: Group[];
  edges: Edge[];
  variables: Variable[];
  theme?: SabFlowTheme;
  settings?: Record<string, unknown>;
}

/**
 * Status of a marketplace template. Mirrors the lifecycle from
 * `docs/ecosystem/slices/05-sabflow-expansion.md` §31.
 */
export type MarketplaceTemplateStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'unlisted'
  | 'rejected';

/**
 * One row in `sabflow_marketplace_templates`.
 *
 * NOTE: every field that's *not* needed by the install path is marked
 * optional and forward-declared — sibling sub-tasks (publish/list/rate) are
 * free to extend the schema as long as they don't reshape the install
 * contract below.
 */
export interface MarketplaceTemplate {
  /** Stable URL-safe identifier (e.g. "lead-capture-hubspot"). */
  slug: string;
  /** Display name shown on the marketplace card. */
  name: string;
  /** Short marketing-style description. */
  description: string;
  /** Author / publisher metadata. */
  author?: {
    userId?: string;
    displayName?: string;
    avatarUrl?: string;
  };
  /** Category buckets (e.g. ["marketing", "lead-gen"]). */
  categories?: string[];
  /** Free-form search tags. */
  tags?: string[];
  /**
   * Credential types this template needs to run end-to-end. The install path
   * cross-checks this against the user's installed credentials and prompts
   * for any missing types BEFORE the flow is cloned.
   */
  requiredCredentials: CredentialType[];
  /** The flow body — what gets cloned into the user's workspace. */
  flow: MarketplaceTemplateFlow;
  /** Lifetime install count, bumped on every successful install. */
  installCount: number;
  /** Aggregate star rating (0–5). Owned by the rating sub-task. */
  rating?: number;
  /** Number of ratings that fed `rating`. */
  ratingCount?: number;
  /** Visibility / moderation status. Install only allowed when "published". */
  status: MarketplaceTemplateStatus;
  /** ISO timestamp of first publish. */
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/* ── Collection accessor ───────────────────────────────────────────────── */

/**
 * Typed `Collection<MarketplaceTemplate>` accessor.
 *
 * Sibling sub-tasks (publish/list/rate) are expected to create their own
 * indexes — we do not bootstrap any here so the install path stays read-only
 * fast-path with no schema-mutation side effects.
 */
export async function getMarketplaceTemplatesCollection(): Promise<
  Collection<MarketplaceTemplate>
> {
  const { db } = await connectToDatabase();
  return db.collection<MarketplaceTemplate>(
    SABFLOW_MARKETPLACE_TEMPLATES_COLLECTION,
  );
}

/* ── Read API ──────────────────────────────────────────────────────────── */

/**
 * Fetch a single published marketplace template by its slug.
 *
 * Returns `null` when no template exists or when its status is not
 * `published` (drafts and rejected rows are invisible to the install path
 * even if a malicious caller knows the slug).
 */
export async function getMarketplaceTemplate(
  slug: string,
): Promise<MarketplaceTemplate | null> {
  if (!slug || typeof slug !== 'string') return null;
  const col = await getMarketplaceTemplatesCollection();
  return col.findOne({ slug, status: 'published' });
}

/* ── Write API ─────────────────────────────────────────────────────────── */

/**
 * Atomically increment a template's `installCount` and stamp `updatedAt`.
 *
 * Implemented as a single `findOneAndUpdate` so concurrent installs from
 * multiple workspaces don't lose updates.
 *
 * Returns the new install count (post-increment), or `null` if the template
 * vanished between the install-time lookup and the increment.
 */
export async function incrementInstallCount(
  slug: string,
): Promise<number | null> {
  if (!slug) return null;
  const col = await getMarketplaceTemplatesCollection();
  const result = await col.findOneAndUpdate(
    { slug, status: 'published' },
    {
      $inc: { installCount: 1 },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after', projection: { installCount: 1 } },
  );
  // mongodb v6 returns the document directly; older return `{ value }`.
  const doc =
    (result && typeof (result as { installCount?: number }).installCount === 'number')
      ? (result as { installCount: number })
      : (result as { value?: { installCount?: number } } | null)?.value ?? null;
  if (!doc || typeof doc.installCount !== 'number') return null;
  return doc.installCount;
}

/**
 * Convenience: shape the public-facing slice used by the marketplace card.
 * No flow body / requiredCredentials — those are only fetched on click.
 */
export type MarketplaceTemplateSummary = Pick<
  MarketplaceTemplate,
  | 'slug'
  | 'name'
  | 'description'
  | 'author'
  | 'categories'
  | 'tags'
  | 'installCount'
  | 'rating'
  | 'ratingCount'
  | 'publishedAt'
>;
