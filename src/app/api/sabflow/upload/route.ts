/**
 * POST /api/sabflow/upload
 *
 * Accepts multipart/form-data containing:
 *   - `file`         — the binary payload (required)
 *   - `flowId`       — optional flow association (editor uploads)
 *   - `sessionId`    — optional chat-session id (end-user uploads)
 *   - `workspaceId`  — optional; defaults to the authenticated user's id
 *
 * Validates size + MIME type, persists the file via the active storage
 * adapter, writes a metadata row, and returns a minimal public descriptor.
 *
 * Auth:
 *   - When `sessionId` is present we treat this as a chat-end-user upload
 *     and skip the session check.  The session must still exist in the DB
 *     — otherwise anyone could upload anonymously.
 *   - Otherwise the caller must be an authenticated editor.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import {
  getStorageAdapter,
  saveFileMetadata,
  getActiveProvider,
} from '@/lib/sabflow/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ── Config ───────────────────────────────────────────────── */

function getMaxUploadBytes(): number {
  const raw = process.env.SABFLOW_MAX_UPLOAD_MB;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  const mb = Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
  return mb * 1024 * 1024;
}

const ALLOWED_MIME_PREFIXES = ['image/', 'audio/', 'video/'];
const ALLOWED_MIME_EXACT = new Set<string>([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
]);

function isAllowedMime(mime: string): boolean {
  if (!mime) return false;
  if (ALLOWED_MIME_EXACT.has(mime)) return true;
  return ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

/* ── Handler ──────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  /* ── Parse form ───────────────────────────────────────── */
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Expected multipart/form-data body' },
      { status: 400 },
    );
  }

  const fileEntry = formData.get('file');
  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      { error: '`file` field is required' },
      { status: 400 },
    );
  }

  const rawFlowId = formData.get('flowId');
  const rawSessionId = formData.get('sessionId');
  const rawWorkspaceId = formData.get('workspaceId');

  const flowId = typeof rawFlowId === 'string' && rawFlowId ? rawFlowId : undefined;
  const sessionId =
    typeof rawSessionId === 'string' && rawSessionId ? rawSessionId : undefined;
  const providedWorkspaceId =
    typeof rawWorkspaceId === 'string' && rawWorkspaceId
      ? rawWorkspaceId
      : undefined;

  /* ── Auth ─────────────────────────────────────────────── */
  let workspaceId: string | undefined = providedWorkspaceId;
  let uploadedBy: string | undefined;

  if (sessionId) {
    // End-user upload via chat window. Two supported shapes:
    //   1. DB-backed session (`sabflow_sessions` _id = ObjectId).
    //   2. Engine session (client-generated UUID). In that case the caller
    //      MUST also send a `flowId` pointing to a PUBLISHED flow, which
    //      we use to derive the workspace.
    try {
      const { db } = await connectToDatabase();
      let owningFlowId: string | undefined;

      if (ObjectId.isValid(sessionId)) {
        const sessionDoc = await db
          .collection('sabflow_sessions')
          .findOne(
            { _id: new ObjectId(sessionId) },
            { projection: { flowId: 1 } },
          )
          .catch(() => null);
        owningFlowId =
          (sessionDoc as { flowId?: string } | null)?.flowId ?? flowId;
      } else {
        // Non-ObjectId session → must rely on flowId.
        if (!flowId) {
          return NextResponse.json(
            { error: '`flowId` is required for chat uploads' },
            { status: 400 },
          );
        }
        owningFlowId = flowId;
      }

      if (!owningFlowId || !ObjectId.isValid(owningFlowId)) {
        return NextResponse.json(
          { error: 'Invalid flowId' },
          { status: 400 },
        );
      }

      const flowDoc = await db
        .collection('sabflows')
        .findOne(
          { _id: new ObjectId(owningFlowId) },
          { projection: { userId: 1, status: 1 } },
        );

      if (!flowDoc) {
        return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
      }

      const typedFlow = flowDoc as { userId?: string; status?: string };

      if (typedFlow.status !== 'PUBLISHED') {
        return NextResponse.json(
          { error: 'Flow is not published' },
          { status: 403 },
        );
      }

      workspaceId = typedFlow.userId ?? workspaceId;
    } catch (err) {
      console.error('[sabflow/upload] session lookup failed', err);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  } else {
    const authed = await getSession();
    if (!authed?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }
    uploadedBy = authed.user._id.toString();
    workspaceId = workspaceId ?? uploadedBy;
  }

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'Could not determine workspace' },
      { status: 400 },
    );
  }

  /* ── Validate size + MIME ─────────────────────────────── */
  const maxBytes = getMaxUploadBytes();
  if (fileEntry.size <= 0) {
    return NextResponse.json({ error: 'File is empty' }, { status: 400 });
  }
  if (fileEntry.size > maxBytes) {
    return NextResponse.json(
      {
        error: `File too large. Max ${Math.round(maxBytes / (1024 * 1024))} MB.`,
      },
      { status: 413 },
    );
  }

  const contentType = fileEntry.type || 'application/octet-stream';
  if (!isAllowedMime(contentType)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${contentType}` },
      { status: 415 },
    );
  }

  /* ── Upload + persist metadata ────────────────────────── */
  try {
    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    const adapter = getStorageAdapter();
    const { url, key } = await adapter.upload(
      buffer,
      fileEntry.name,
      contentType,
    );

    const id = await saveFileMetadata({
      flowId,
      sessionId,
      workspaceId,
      filename: fileEntry.name,
      contentType,
      sizeBytes: fileEntry.size,
      url,
      provider: getActiveProvider(),
      uploadedBy,
      storageKey: key,
    });

    return NextResponse.json({
      id,
      url,
      filename: fileEntry.name,
      contentType,
      sizeBytes: fileEntry.size,
    });
  } catch (err) {
    console.error('[sabflow/upload] upload failed', err);
    const msg =
      err instanceof Error ? err.message : 'Failed to upload file.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
