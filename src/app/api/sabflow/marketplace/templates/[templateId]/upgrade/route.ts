/**
 * POST /api/sabflow/marketplace/templates/[templateId]/upgrade
 *
 * Phase C.10.7 — Template versioning + upgrade diff.
 *
 * Re-installs the newer version of a marketplace template as a **new**
 * SabFlow doc — it does NOT overwrite the existing flow identified by
 * `installedDocId`. The original flow is preserved; the new doc's settings
 * record a lineage reference back to the original.
 *
 * Body:
 *   {
 *     installedDocId: string   — existing flow doc id (for lineage stamp)
 *     fromVersion:    string   — currently installed version
 *     toVersion:      string   — version to upgrade to
 *   }
 *
 * Response (201):
 *   { newFlowId: string, editorUrl: string }
 *
 * Response (400) — missing / invalid body fields
 * Response (401) — not authenticated
 * Response (404) — template or target version not found
 * Response (500) — unexpected error
 *
 * Implementation notes:
 *   - Fetches `toVersion`'s `flowJson` from `sabflow_marketplace_versions`.
 *   - Uses `remapFlowIds` (the same id-remap helper used by the install
 *     path) so the cloned doc gets fresh ids throughout.
 *   - Stamps `settings.marketplaceUpgrade` with the lineage so the editor
 *     can surface "upgraded from vX.Y.Z" information.
 *   - Never touches the original `installedDocId` doc — immutable upgrade
 *     path only.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getSabFlowCollection } from '@/lib/sabflow/db';
import { remapFlowIds } from '@/lib/sabflow/marketplace/install';
import type { SabFlowDoc } from '@/lib/sabflow/types';

import {
  SABFLOW_MARKETPLACE_VERSIONS_COLLECTION,
} from '@/lib/sabflow/marketplace/versioning';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface UpgradeBody {
  installedDocId?: unknown;
  fromVersion?: unknown;
  toVersion?: unknown;
}

interface RouteContext {
  params: Promise<{ templateId: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  /* ── Auth ────────────────────────────────────────────────────────────── */
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }
  const userId = (session.user as { _id: { toString(): string } })._id.toString();

  /* ── Path param ─────────────────────────────────────────────────────── */
  const { templateId } = await context.params;
  if (!templateId) {
    return NextResponse.json(
      { error: '`templateId` path parameter is required' },
      { status: 400 },
    );
  }

  /* ── Parse body ─────────────────────────────────────────────────────── */
  let body: UpgradeBody;
  try {
    body = (await request.json()) as UpgradeBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const installedDocId =
    typeof body.installedDocId === 'string' ? body.installedDocId.trim() : '';
  const fromVersion =
    typeof body.fromVersion === 'string' ? body.fromVersion.trim() : '';
  const toVersion =
    typeof body.toVersion === 'string' ? body.toVersion.trim() : '';

  if (!installedDocId) {
    return NextResponse.json(
      { error: '`installedDocId` is required' },
      { status: 400 },
    );
  }
  if (!fromVersion) {
    return NextResponse.json(
      { error: '`fromVersion` is required' },
      { status: 400 },
    );
  }
  if (!toVersion) {
    return NextResponse.json(
      { error: '`toVersion` is required' },
      { status: 400 },
    );
  }
  if (fromVersion === toVersion) {
    return NextResponse.json(
      { error: '`fromVersion` and `toVersion` must differ' },
      { status: 400 },
    );
  }

  /* ── Run upgrade ────────────────────────────────────────────────────── */
  try {
    const { db } = await connectToDatabase();
    const versionsCol = db.collection<{
      templateId: string;
      version: string;
      flowJson: Record<string, unknown>;
      changelog: string;
    }>(SABFLOW_MARKETPLACE_VERSIONS_COLLECTION);

    /* Fetch the target version's flow snapshot. */
    const versionDoc = await versionsCol.findOne({
      templateId,
      version: toVersion,
    });

    if (!versionDoc) {
      return NextResponse.json(
        {
          error: `Version "${toVersion}" not found for template "${templateId}"`,
        },
        { status: 404 },
      );
    }

    /* Remap all ids so the cloned doc is fully independent. */
    const flowJson = versionDoc.flowJson as unknown as Parameters<typeof remapFlowIds>[0];
    const cloned = remapFlowIds(flowJson);

    const now = new Date();
    const newId = new ObjectId();

    const doc: SabFlowDoc = {
      _id: newId,
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
          version: toVersion,
          installedAt: now.toISOString(),
        },
        marketplaceUpgrade: {
          fromVersion,
          toVersion,
          upgradedAt: now.toISOString(),
          previousDocId: installedDocId,
        },
      },
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
    } as SabFlowDoc;

    const col = await getSabFlowCollection();
    await col.insertOne(doc);

    const newFlowId = newId.toHexString();
    const editorUrl = `/dashboard/sabflow/flow-builder/${newFlowId}`;

    return NextResponse.json({ newFlowId, editorUrl }, { status: 201 });
  } catch (err) {
    console.error('[SABFLOW MARKETPLACE UPGRADE] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
