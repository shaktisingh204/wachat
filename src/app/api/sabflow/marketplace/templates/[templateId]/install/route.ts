/**
 * POST /api/sabflow/marketplace/templates/[templateId]/install
 *
 * Phase C.10 · sub-task #6 — one-click install by templateId.
 *
 * Response shapes:
 *   • 201 { docId, editorUrl }
 *     The flow has been cloned; navigate to `editorUrl`.
 *
 *   • 401 { error }  not authenticated
 *   • 403 { error }  missing `sabflow.doc.write` RBAC permission
 *   • 404 { error }  templateId not found / not published
 *   • 429 { error }  rate-limit exceeded (10 installs / user / hour)
 *   • 500 { error }  unexpected
 *
 * Internals:
 *   - Looks up the template from `sabflow_marketplace_templates` by ObjectId.
 *   - Clones the `flow.json` into `sabflows` with the requester's `userId`.
 *   - Records the install in `sabflow_marketplace_installs`.
 *   - Increments `installCount` on the template document atomically.
 *   - Rate limit: 10 installs per user per hour, via Redis (INCR + EXPIRE) with
 *     an in-memory Map fallback for environments where Redis is unavailable.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { connectToDatabase } from '@/lib/mongodb';
import { getSabFlowCollection } from '@/lib/sabflow/db';
import {
  getMarketplaceTemplatesCollection,
  type MarketplaceTemplate,
  type MarketplaceTemplateFlow,
} from '@/lib/sabflow/marketplace/templates';
import { remapFlowIds } from '@/lib/sabflow/marketplace/install';
import type { SabFlowDoc } from '@/lib/sabflow/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ── Rate-limit helpers ────────────────────────────────────────────────── */

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SEC = 3600; // 1 hour

/**
 * In-memory fallback for environments without Redis.
 * Each entry is { count, resetAt } keyed by userId.
 */
const inMemoryRateLimitMap = new Map<string, { count: number; resetAt: number }>();

type RedisLikeClient = {
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number | boolean>;
  ttl: (key: string) => Promise<number>;
};

const { getRedisClient } = require('@/lib/redis') as {
  getRedisClient: () => Promise<RedisLikeClient>;
};

/**
 * Returns `true` when the user has exceeded the install rate limit,
 * `false` when the request is within quota.
 *
 * Tries Redis first; on any failure falls back to the in-memory Map so a
 * Redis outage never blocks legitimate installs.
 */
async function isRateLimited(userId: string): Promise<boolean> {
  const key = `sabflow:marketplace:install:rl:${userId}`;

  /* ── Try Redis ─────────────────────────────────────────────────────── */
  try {
    const redis = await getRedisClient();
    const count = await redis.incr(key);
    if (count === 1) {
      // First request in this window — set the expiry.
      await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    }
    return count > RATE_LIMIT_MAX;
  } catch {
    /* Redis unavailable — fall through to in-memory fallback */
  }

  /* ── In-memory fallback ────────────────────────────────────────────── */
  const now = Date.now();
  const entry = inMemoryRateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    inMemoryRateLimitMap.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_SEC * 1000,
    });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

/* ── Install record ────────────────────────────────────────────────────── */

interface InstallRecord {
  templateId: string;
  userId: string;
  workspaceId: string;
  installedAt: Date;
  docId: string;
}

async function recordInstall(record: InstallRecord): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection<InstallRecord>('sabflow_marketplace_installs');
  // Lazy-create index on first write — idempotent.
  await col.createIndex({ userId: 1, installedAt: -1 }, { background: true });
  await col.createIndex({ templateId: 1 }, { background: true });
  await col.insertOne(record);
}

/* ── Increment installCount on the template ────────────────────────────── */

async function incrementInstallCountById(
  templateId: string,
): Promise<number | null> {
  try {
    const col = await getMarketplaceTemplatesCollection();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (col as any).findOneAndUpdate(
      { _id: new ObjectId(templateId), status: 'published' },
      {
        $inc: { installCount: 1 },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after', projection: { installCount: 1 } },
    );
    // mongodb driver v6 returns the doc directly; older versions wrap in {value}.
    const doc =
      result && typeof (result as { installCount?: number }).installCount === 'number'
        ? (result as { installCount: number })
        : (result as { value?: { installCount?: number } } | null)?.value ?? null;
    return typeof doc?.installCount === 'number' ? doc.installCount : null;
  } catch (err) {
    console.error('[sabflow/marketplace/install] incrementInstallCountById failed:', err);
    return null;
  }
}

/* ── Route handler ─────────────────────────────────────────────────────── */

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ templateId: string }> },
) {
  /* ── 1. Auth ─────────────────────────────────────────────────────────── */
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }
  const userId = String((session.user as { _id: { toString(): string } })._id);
  const workspaceId = String(
    (session.user as { activeProjectId?: string }).activeProjectId ?? userId,
  );

  /* ── 2. RBAC: requires sabflow.doc.write (create a new flow doc) ─────── */
  const guard = await requirePermission('sabflow.doc.write', 'create', workspaceId);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: 403 });
  }

  /* ── 3. Rate limit ───────────────────────────────────────────────────── */
  const limited = await isRateLimited(userId);
  if (limited) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. You may install at most 10 templates per hour.' },
      { status: 429 },
    );
  }

  /* ── 4. Resolve templateId ───────────────────────────────────────────── */
  const { templateId } = await context.params;
  if (!templateId || !ObjectId.isValid(templateId)) {
    return NextResponse.json(
      { error: 'Invalid templateId.' },
      { status: 400 },
    );
  }

  /* ── 5. Fetch the template ───────────────────────────────────────────── */
  const col = await getMarketplaceTemplatesCollection();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const template: MarketplaceTemplate | null = await (col as any).findOne({
    _id: new ObjectId(templateId),
    status: 'published',
  });

  if (!template) {
    return NextResponse.json(
      { error: 'Template not found or not published.' },
      { status: 404 },
    );
  }

  /* ── 6. Clone the flow ───────────────────────────────────────────────── */
  try {
    const cloned: MarketplaceTemplateFlow = remapFlowIds(template.flow);
    const now = new Date();
    const docOid = new ObjectId();

    const doc: SabFlowDoc = {
      _id: docOid,
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
          templateId,
          installedAt: now.toISOString(),
        },
      },
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
    } as SabFlowDoc;

    const flowCol = await getSabFlowCollection();
    await flowCol.insertOne(doc);

    const docId = docOid.toHexString();

    /* ── 7. Record install + bump installCount (parallel, best-effort) ── */
    await Promise.all([
      recordInstall({
        templateId,
        userId,
        workspaceId,
        installedAt: now,
        docId,
      }),
      incrementInstallCountById(templateId),
    ]);

    const editorUrl = `/dashboard/sabflow/flow-builder/${docId}`;
    return NextResponse.json({ docId, editorUrl }, { status: 201 });
  } catch (err) {
    console.error('[SABFLOW MARKETPLACE TEMPLATES INSTALL] Error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
