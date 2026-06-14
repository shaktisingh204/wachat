'use server';

/**
 * SabWriter server actions.
 *
 * Strategy:
 *   1. Prefer the Rust crates (`sabwriter-documents`, `sabwriter-versions`,
 *      `sabwriter-comments`, `sabwriter-suggestions`, `sabwriter-templates`,
 *      `sabwriter-presence`) for all reads / writes.
 *   2. Multi-tenant — every action calls `getSession()` to confirm the
 *      caller, and the Rust side filters by `(userId | sharedWithUserIds)`.
 *   3. The "send for signature" bridge instantiates a SabSign envelope
 *      from the latest version of the document. It tries to call the
 *      existing `createEnvelope` action from `sabsign.actions` so all the
 *      envelope plumbing is reused (audit, access tokens, routing).
 */

import 'server-only';

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabwriterDocumentsApi } from '@/lib/rust-client/sabwriter-documents';
import { sabwriterVersionsApi } from '@/lib/rust-client/sabwriter-versions';
import { sabwriterCommentsApi } from '@/lib/rust-client/sabwriter-comments';
import { sabwriterSuggestionsApi } from '@/lib/rust-client/sabwriter-suggestions';
import { sabwriterTemplatesApi } from '@/lib/rust-client/sabwriter-templates';
import { sabwriterPresenceApi } from '@/lib/rust-client/sabwriter-presence';
import type {
  CreateDocumentInput,
  DocumentListParams,
  SabwriterDocumentDoc,
  UpdateDocumentInput,
} from '@/lib/rust-client/sabwriter-documents';
import type {
  CreateCommentInput,
  CommentListParams,
  UpdateCommentInput,
} from '@/lib/rust-client/sabwriter-comments';
import type {
  CreateSuggestionInput,
  SuggestionListParams,
} from '@/lib/rust-client/sabwriter-suggestions';
import type {
  CreateTemplateInput,
  TemplateListParams,
  UpdateTemplateInput,
} from '@/lib/rust-client/sabwriter-templates';
import type {
  HeartbeatInput,
} from '@/lib/rust-client/sabwriter-presence';

import { createEnvelope } from '@/app/actions/sabsign.actions';
import type {
  CreateEnvelopeInput,
} from '@/lib/rust-client/sabsign-envelopes';

// ── Helpers ──────────────────────────────────────────────────────────

async function requireUser() {
  const session = await getSession();
  if (!session?.user?._id) {
    throw new Error('Unauthorized');
  }
  return session.user;
}

const DOCS_LIST_PATH = '/sabsign/docs';
const DOC_PATH = (id: string) => `/sabsign/docs/${id}`;

// ── Documents ────────────────────────────────────────────────────────

export async function listSabwriterDocuments(params?: DocumentListParams) {
  await requireUser();
  try {
    return await sabwriterDocumentsApi.list(params);
  } catch (err) {
    if (err instanceof RustApiError) {
      console.error('[sabwriter] list documents failed:', err.message);
      return { items: [], page: 0, limit: 25, hasMore: false };
    }
    throw err;
  }
}

export async function getSabwriterDocument(id: string) {
  await requireUser();
  return sabwriterDocumentsApi.getById(id);
}

export async function createSabwriterDocument(input: CreateDocumentInput) {
  await requireUser();
  const res = await sabwriterDocumentsApi.create(input);
  revalidatePath(DOCS_LIST_PATH);
  return res;
}

export async function updateSabwriterDocument(
  id: string,
  patch: UpdateDocumentInput,
) {
  await requireUser();
  const res = await sabwriterDocumentsApi.update(id, patch);
  revalidatePath(DOC_PATH(id));
  revalidatePath(DOCS_LIST_PATH);
  return res;
}

export async function deleteSabwriterDocument(id: string) {
  await requireUser();
  const res = await sabwriterDocumentsApi.delete(id);
  revalidatePath(DOCS_LIST_PATH);
  return res;
}

export async function shareSabwriterDocument(id: string, userIds: string[]) {
  await requireUser();
  const res = await sabwriterDocumentsApi.share(id, userIds);
  revalidatePath(DOC_PATH(id));
  return res;
}

// ── Versions ─────────────────────────────────────────────────────────

export async function listSabwriterVersions(documentId: string) {
  await requireUser();
  return sabwriterVersionsApi.list({ documentId, limit: 100 });
}

export async function saveSabwriterVersion(docId: string, comment?: string) {
  await requireUser();
  const doc = await sabwriterDocumentsApi.getById(docId);
  const res = await sabwriterVersionsApi.create({
    documentId: docId,
    contentJson: doc.contentJson ?? {},
    comment,
  });
  revalidatePath(DOC_PATH(docId));
  revalidatePath(`${DOC_PATH(docId)}/history`);
  return res;
}

export async function restoreSabwriterVersion(versionId: string) {
  await requireUser();
  const version = await sabwriterVersionsApi.getById(versionId);
  // Write the snapshot back to the document.
  const updated = await sabwriterDocumentsApi.update(version.documentId, {
    contentJson: version.contentJson,
  });
  // Save a fresh version stamp so the restore itself is reflected in
  // history.
  await sabwriterVersionsApi.create({
    documentId: version.documentId,
    contentJson: version.contentJson,
    comment: `Restored from version ${version.version}`,
  });
  revalidatePath(DOC_PATH(version.documentId));
  revalidatePath(`${DOC_PATH(version.documentId)}/history`);
  return updated;
}

// ── Comments ─────────────────────────────────────────────────────────

export async function listSabwriterComments(params: CommentListParams) {
  await requireUser();
  return sabwriterCommentsApi.list(params);
}

export async function getSabwriterComment(id: string) {
  await requireUser();
  return sabwriterCommentsApi.getById(id);
}

export async function addSabwriterComment(input: CreateCommentInput) {
  await requireUser();
  const res = await sabwriterCommentsApi.create(input);
  revalidatePath(DOC_PATH(input.documentId));
  return res;
}

export async function updateSabwriterComment(
  id: string,
  patch: UpdateCommentInput,
) {
  await requireUser();
  return sabwriterCommentsApi.update(id, patch);
}

export async function resolveSabwriterComment(id: string) {
  await requireUser();
  const res = await sabwriterCommentsApi.resolve(id);
  if (res.documentId) revalidatePath(DOC_PATH(res.documentId));
  return res;
}

export async function deleteSabwriterComment(id: string) {
  await requireUser();
  return sabwriterCommentsApi.delete(id);
}

// ── Suggestions ──────────────────────────────────────────────────────

export async function listSabwriterSuggestions(params: SuggestionListParams) {
  await requireUser();
  return sabwriterSuggestionsApi.list(params);
}

export async function proposeSabwriterSuggestion(input: CreateSuggestionInput) {
  await requireUser();
  const res = await sabwriterSuggestionsApi.create(input);
  revalidatePath(DOC_PATH(input.documentId));
  return res;
}

export async function acceptSabwriterSuggestion(id: string) {
  await requireUser();
  const res = await sabwriterSuggestionsApi.accept(id);
  if (res.entity?.documentId) revalidatePath(DOC_PATH(res.entity.documentId));
  return res;
}

export async function rejectSabwriterSuggestion(id: string) {
  await requireUser();
  const res = await sabwriterSuggestionsApi.reject(id);
  if (res.entity?.documentId) revalidatePath(DOC_PATH(res.entity.documentId));
  return res;
}

// ── Templates ────────────────────────────────────────────────────────

export async function listSabwriterTemplates(params?: TemplateListParams) {
  await requireUser();
  try {
    return await sabwriterTemplatesApi.list(params);
  } catch (err) {
    if (err instanceof RustApiError) {
      console.error('[sabwriter] list templates failed:', err.message);
      return { items: [], page: 0, limit: 25, hasMore: false };
    }
    throw err;
  }
}

export async function getSabwriterTemplate(id: string) {
  await requireUser();
  return sabwriterTemplatesApi.getById(id);
}

export async function createSabwriterTemplate(input: CreateTemplateInput) {
  await requireUser();
  const res = await sabwriterTemplatesApi.create(input);
  revalidatePath(`${DOCS_LIST_PATH}/templates`);
  return res;
}

export async function updateSabwriterTemplate(
  id: string,
  patch: UpdateTemplateInput,
) {
  await requireUser();
  return sabwriterTemplatesApi.update(id, patch);
}

export async function deleteSabwriterTemplate(id: string) {
  await requireUser();
  const res = await sabwriterTemplatesApi.delete(id);
  revalidatePath(`${DOCS_LIST_PATH}/templates`);
  return res;
}

/**
 * Instantiate a fresh document from a template (server-side helper).
 */
export async function createDocumentFromTemplate(
  templateId: string,
  title?: string,
) {
  await requireUser();
  const tmpl = await sabwriterTemplatesApi.getById(templateId);
  return createSabwriterDocument({
    title: title?.trim() || `${tmpl.name} (copy)`,
    contentJson: tmpl.contentJson ?? {},
  });
}

// ── Presence ─────────────────────────────────────────────────────────

export async function listSabwriterPresence(documentId: string) {
  await requireUser();
  return sabwriterPresenceApi.list(documentId);
}

export async function heartbeatSabwriterPresence(input: HeartbeatInput) {
  await requireUser();
  return sabwriterPresenceApi.heartbeat(input);
}

export async function leaveSabwriterPresence(documentId: string) {
  await requireUser();
  return sabwriterPresenceApi.leave(documentId);
}

// ── Send for signature ───────────────────────────────────────────────

/**
 * Bridge a SabWriter document into the SabSign envelope flow.
 *
 * The current TipTap-based document body is not yet rendered to PDF; we
 * stamp the envelope with a placeholder `docId` and leave the PDF
 * render as a TODO. Once `renderSabwriterDocToPdf` is implemented, swap
 * the body of `envelopeArgs.docId` for the SabFiles id of the rendered
 * PDF.
 *
 * Wiring TODO:
 *   - Implement `renderSabwriterDocToPdf(docId)` that produces a SabFiles
 *     entry from `contentJson` (likely via Playwright + react-pdf).
 *   - Have it return `{ sabFileId, sabFileUrl }` to plug into the envelope.
 */
export async function sendDocumentForSignature(
  docId: string,
  envelopeArgs: Partial<CreateEnvelopeInput> & {
    name?: string;
    signers?: CreateEnvelopeInput['signers'];
  },
): Promise<{ documentId: string; envelopeId: string }> {
  await requireUser();
  const doc: SabwriterDocumentDoc = await sabwriterDocumentsApi.getById(docId);

  // Snapshot the doc so the signed-from version is preserved in history.
  await sabwriterVersionsApi.create({
    documentId: docId,
    contentJson: doc.contentJson ?? {},
    comment: 'Snapshot before send-for-signature',
  });

  // TODO(render): render `doc.contentJson` to a PDF and upload to SabFiles.
  // For now, the envelope is created against a placeholder doc reference
  // so the rest of the SabSign flow can be wired and exercised.
  const placeholderDocId = `sabwriter:${docId}`;

  const envelopeInput: CreateEnvelopeInput = {
    name: envelopeArgs.name ?? doc.title,
    docId: envelopeArgs.docId ?? placeholderDocId,
    docName: envelopeArgs.docName ?? `${doc.title}.pdf`,
    docUrl: envelopeArgs.docUrl,
    subject: envelopeArgs.subject,
    message: envelopeArgs.message,
    routingOrder: envelopeArgs.routingOrder ?? 'sequential',
    routingRules: envelopeArgs.routingRules,
    signers: envelopeArgs.signers ?? [],
    fields: envelopeArgs.fields ?? [],
    expiresAt: envelopeArgs.expiresAt,
    reminderDays: envelopeArgs.reminderDays,
    inPerson: envelopeArgs.inPerson,
    templateId: envelopeArgs.templateId,
    bulkBatchId: envelopeArgs.bulkBatchId,
  };

  // Use the existing SabSign action so audit, access tokens, and RBAC
  // gates are all reused.
  const created = await createEnvelope(envelopeInput);
  const envelopeId =
    (created as { id?: string; entity?: { _id?: string } })?.id ??
    (created as { entity?: { _id?: string } })?.entity?._id ??
    '';

  // Flip the SabWriter document status + back-reference the envelope.
  await sabwriterDocumentsApi.update(docId, {
    status: 'sent_for_signature',
    envelopeId,
  });

  revalidatePath(DOC_PATH(docId));
  revalidatePath('/sabsign');
  return { documentId: docId, envelopeId };
}

// ── Mongo-side helpers (audit / future blob handoff) ─────────────────

/**
 * Ensure the TTL index on `sabwriter_presence.lastSeenAt` exists. Safe
 * to call from cold-start hooks. Not invoked automatically.
 */
export async function ensureSabwriterIndexes(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection('sabwriter_presence')
    .createIndex({ lastSeenAt: 1 }, { expireAfterSeconds: 90 })
    .catch(() => {
      /* index already exists / not authorised */
    });
  await db
    .collection('sabwriter_documents')
    .createIndex({ userId: 1, status: 1, updatedAt: -1 })
    .catch(() => {});
  await db
    .collection('sabwriter_documents')
    .createIndex({ sharedWithUserIds: 1, updatedAt: -1 })
    .catch(() => {});
  await db
    .collection('sabwriter_document_versions')
    .createIndex({ documentId: 1, version: -1 })
    .catch(() => {});
  await db
    .collection('sabwriter_comments')
    .createIndex({ documentId: 1, resolved: 1, createdAt: 1 })
    .catch(() => {});
  await db
    .collection('sabwriter_suggestions')
    .createIndex({ documentId: 1, status: 1, createdAt: 1 })
    .catch(() => {});
}
