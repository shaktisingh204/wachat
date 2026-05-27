'use server';

/**
 * SabPractice server actions — accountant practice management.
 *
 * Backed by the eight Rust crates under `rust/crates/sabpractice-*`. All
 * actions are tenant-scoped (`session.user._id`) and the Rust side
 * enforces `userId == AuthUser.user_id` on every query.
 *
 * Documents live in SabFiles only — `uploadSabpracticeDocument` binds
 * an existing SabFiles `fileId` into a document-request row; nothing
 * here uploads raw bytes.
 */

import 'server-only';

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { RustApiError } from '@/lib/rust-client/fetcher';

import {
  sabpracticeFirmsApi,
  type SabPracticeFirmCreateInput,
  type SabPracticeFirmUpdateInput,
} from '@/lib/rust-client/sabpractice-firms';
import {
  sabpracticeClientsApi,
  type SabPracticeClientCreateInput,
  type SabPracticeClientUpdateInput,
} from '@/lib/rust-client/sabpractice-clients';
import {
  sabpracticeEngagementsApi,
  type SabPracticeEngagementCreateInput,
  type SabPracticeEngagementUpdateInput,
} from '@/lib/rust-client/sabpractice-engagements';
import {
  sabpracticeDocumentRequestsApi,
  type SabPracticeDocumentRequestCreateInput,
  type SabPracticeDocumentRequestUpdateInput,
  type SabPracticeRequestedFile,
} from '@/lib/rust-client/sabpractice-document-requests';
import {
  sabpracticeTasksApi,
  type SabPracticeTaskCreateInput,
  type SabPracticeTaskUpdateInput,
} from '@/lib/rust-client/sabpractice-tasks';
import {
  sabpracticeTimeLogsApi,
  listSabpracticeTimeLogsWithTotals,
  type SabPracticeTimeLogCreateInput,
  type SabPracticeTimeLogUpdateInput,
  type TimeLogListParams,
} from '@/lib/rust-client/sabpractice-time-logs';
import {
  sabpracticeAdvisoryNotesApi,
  type SabPracticeAdvisoryNoteCreateInput,
  type SabPracticeAdvisoryNoteUpdateInput,
} from '@/lib/rust-client/sabpractice-advisory-notes';
import {
  sabpracticeDeadlinesApi,
  type SabPracticeDeadlineCreateInput,
  type SabPracticeDeadlineUpdateInput,
  type SabPracticeDeadlineFileInput,
} from '@/lib/rust-client/sabpractice-deadlines';

// ── Helpers ──────────────────────────────────────────────────────────

async function requireUser() {
  const session = await getSession();
  if (!session?.user?._id) {
    throw new Error('Unauthorized');
  }
  return session.user;
}

function revalidateRoot() {
  revalidatePath('/dashboard/sabpractice');
}

function revalidateClient(clientId?: string) {
  revalidateRoot();
  if (clientId) revalidatePath(`/dashboard/sabpractice/clients/${clientId}`);
}

function emptyList<T>() {
  return { items: [] as T[], page: 0, limit: 25, hasMore: false };
}

// ── Firms ────────────────────────────────────────────────────────────

export async function listSabpracticeFirms(params?: { q?: string; page?: number; limit?: number; status?: string }) {
  await requireUser();
  try {
    return await sabpracticeFirmsApi.list({
      q: params?.q,
      page: params?.page,
      limit: params?.limit,
      filter: params?.status ? { status: params.status } : undefined,
    });
  } catch (err) {
    if (err instanceof RustApiError) {
      console.error('[sabpractice] listFirms failed:', err.message);
      return emptyList();
    }
    throw err;
  }
}

export async function getSabpracticeFirm(id: string) {
  await requireUser();
  return sabpracticeFirmsApi.getById(id);
}

export async function createSabpracticeFirm(input: SabPracticeFirmCreateInput) {
  await requireUser();
  const res = await sabpracticeFirmsApi.create(input);
  revalidateRoot();
  return res;
}

export async function updateSabpracticeFirm(id: string, patch: SabPracticeFirmUpdateInput) {
  await requireUser();
  const res = await sabpracticeFirmsApi.update(id, patch);
  revalidateRoot();
  return res;
}

export async function deleteSabpracticeFirm(id: string) {
  await requireUser();
  const res = await sabpracticeFirmsApi.delete(id);
  revalidateRoot();
  return res;
}

// ── Clients ──────────────────────────────────────────────────────────

export async function listSabpracticeClients(params?: {
  q?: string;
  page?: number;
  limit?: number;
  status?: string;
  firmId?: string;
  assignedTo?: string;
}) {
  await requireUser();
  try {
    return await sabpracticeClientsApi.list({
      q: params?.q,
      page: params?.page,
      limit: params?.limit,
      filter:
        params?.status || params?.firmId || params?.assignedTo
          ? {
              status: params?.status,
              firmId: params?.firmId,
              assignedTo: params?.assignedTo,
            }
          : undefined,
    });
  } catch (err) {
    if (err instanceof RustApiError) {
      console.error('[sabpractice] listClients failed:', err.message);
      return emptyList();
    }
    throw err;
  }
}

export async function getSabpracticeClient(id: string) {
  await requireUser();
  return sabpracticeClientsApi.getById(id);
}

export async function createSabpracticeClient(input: SabPracticeClientCreateInput) {
  await requireUser();
  const res = await sabpracticeClientsApi.create(input);
  revalidatePath('/dashboard/sabpractice/clients');
  revalidateRoot();
  return res;
}

export async function updateSabpracticeClient(id: string, patch: SabPracticeClientUpdateInput) {
  await requireUser();
  const res = await sabpracticeClientsApi.update(id, patch);
  revalidateClient(id);
  return res;
}

export async function deleteSabpracticeClient(id: string) {
  await requireUser();
  const res = await sabpracticeClientsApi.delete(id);
  revalidateClient(id);
  return res;
}

// ── Engagements ─────────────────────────────────────────────────────

export async function listSabpracticeEngagements(params?: {
  q?: string;
  page?: number;
  limit?: number;
  status?: string;
  clientId?: string;
}) {
  await requireUser();
  try {
    return await sabpracticeEngagementsApi.list({
      q: params?.q,
      page: params?.page,
      limit: params?.limit,
      filter:
        params?.status || params?.clientId
          ? { status: params?.status, clientId: params?.clientId }
          : undefined,
    });
  } catch (err) {
    if (err instanceof RustApiError) {
      console.error('[sabpractice] listEngagements failed:', err.message);
      return emptyList();
    }
    throw err;
  }
}

export async function getSabpracticeEngagement(id: string) {
  await requireUser();
  return sabpracticeEngagementsApi.getById(id);
}

export async function createSabpracticeEngagement(input: SabPracticeEngagementCreateInput) {
  await requireUser();
  const res = await sabpracticeEngagementsApi.create(input);
  revalidateClient(input.clientId);
  return res;
}

export async function updateSabpracticeEngagement(id: string, patch: SabPracticeEngagementUpdateInput) {
  await requireUser();
  const res = await sabpracticeEngagementsApi.update(id, patch);
  revalidateRoot();
  return res;
}

export async function deleteSabpracticeEngagement(id: string) {
  await requireUser();
  const res = await sabpracticeEngagementsApi.delete(id);
  revalidateRoot();
  return res;
}

// ── Document Requests ──────────────────────────────────────────────

export async function listSabpracticeDocumentRequests(params?: {
  q?: string;
  page?: number;
  limit?: number;
  status?: string;
  clientId?: string;
  engagementId?: string;
}) {
  await requireUser();
  try {
    return await sabpracticeDocumentRequestsApi.list({
      q: params?.q,
      page: params?.page,
      limit: params?.limit,
      filter:
        params?.status || params?.clientId || params?.engagementId
          ? {
              status: params?.status,
              clientId: params?.clientId,
              engagementId: params?.engagementId,
            }
          : undefined,
    });
  } catch (err) {
    if (err instanceof RustApiError) {
      console.error('[sabpractice] listDocumentRequests failed:', err.message);
      return emptyList();
    }
    throw err;
  }
}

export async function getSabpracticeDocumentRequest(id: string) {
  await requireUser();
  return sabpracticeDocumentRequestsApi.getById(id);
}

/**
 * Create a new document request (the firm "requests" docs from a client).
 */
export async function requestSabpracticeDocument(input: SabPracticeDocumentRequestCreateInput) {
  await requireUser();
  const res = await sabpracticeDocumentRequestsApi.create(input);
  revalidatePath('/dashboard/sabpractice/document-requests');
  revalidateClient(input.clientId);
  return res;
}

export async function updateSabpracticeDocumentRequest(id: string, patch: SabPracticeDocumentRequestUpdateInput) {
  await requireUser();
  const res = await sabpracticeDocumentRequestsApi.update(id, patch);
  revalidatePath('/dashboard/sabpractice/document-requests');
  return res;
}

export async function deleteSabpracticeDocumentRequest(id: string) {
  await requireUser();
  const res = await sabpracticeDocumentRequestsApi.delete(id);
  revalidatePath('/dashboard/sabpractice/document-requests');
  return res;
}

/**
 * Bind an uploaded SabFiles file to a single slot inside a document
 * request. The caller has already uploaded via `<SabFilePickerButton>`
 * and now passes the `fileId` + `url` it received from SabFiles.
 *
 * `slotIndex` identifies which entry in `requestedFiles[]` to bind.
 */
export async function uploadSabpracticeDocument(args: {
  requestId: string;
  slotIndex: number;
  fileId: string;
  fileUrl?: string;
  note?: string;
}) {
  await requireUser();
  const current = await sabpracticeDocumentRequestsApi.getById(args.requestId);
  if (!current) throw new Error('Document request not found');

  const slots: SabPracticeRequestedFile[] = [...(current.requestedFiles ?? [])];
  if (args.slotIndex < 0 || args.slotIndex >= slots.length) {
    throw new Error('Invalid slot index');
  }
  slots[args.slotIndex] = {
    ...slots[args.slotIndex],
    status: 'uploaded',
    fileId: args.fileId,
    fileUrl: args.fileUrl,
    note: args.note ?? slots[args.slotIndex].note,
    uploadedAt: new Date().toISOString(),
  };

  const allUploaded = slots.every((s) => s.status === 'uploaded' || s.status === 'approved');
  const res = await sabpracticeDocumentRequestsApi.update(args.requestId, {
    requestedFiles: slots,
    status: allUploaded ? 'received' : current.status,
  });
  revalidatePath('/dashboard/sabpractice/document-requests');
  revalidateClient(current.clientId);
  return res;
}

// ── Tasks ────────────────────────────────────────────────────────────

export async function listSabpracticeTasks(params?: {
  q?: string;
  page?: number;
  limit?: number;
  status?: string;
  clientId?: string;
  engagementId?: string;
  assigneeUserId?: string;
}) {
  await requireUser();
  try {
    return await sabpracticeTasksApi.list({
      q: params?.q,
      page: params?.page,
      limit: params?.limit,
      filter: {
        status: params?.status,
        clientId: params?.clientId,
        engagementId: params?.engagementId,
        assigneeUserId: params?.assigneeUserId,
      },
    });
  } catch (err) {
    if (err instanceof RustApiError) {
      console.error('[sabpractice] listTasks failed:', err.message);
      return emptyList();
    }
    throw err;
  }
}

export async function getSabpracticeTask(id: string) {
  await requireUser();
  return sabpracticeTasksApi.getById(id);
}

export async function createSabpracticeTask(input: SabPracticeTaskCreateInput) {
  await requireUser();
  const res = await sabpracticeTasksApi.create(input);
  revalidateClient(input.clientId);
  return res;
}

export async function updateSabpracticeTask(id: string, patch: SabPracticeTaskUpdateInput) {
  await requireUser();
  const res = await sabpracticeTasksApi.update(id, patch);
  revalidateRoot();
  return res;
}

export async function deleteSabpracticeTask(id: string) {
  await requireUser();
  const res = await sabpracticeTasksApi.delete(id);
  revalidateRoot();
  return res;
}

// ── Time Logs ───────────────────────────────────────────────────────

export async function listSabpracticeTimeLogs(params?: TimeLogListParams) {
  await requireUser();
  try {
    return await listSabpracticeTimeLogsWithTotals(params);
  } catch (err) {
    if (err instanceof RustApiError) {
      console.error('[sabpractice] listTimeLogs failed:', err.message);
      return { items: [], page: 0, limit: 25, hasMore: false, totalHours: 0, billableHours: 0 };
    }
    throw err;
  }
}

export async function getSabpracticeTimeLog(id: string) {
  await requireUser();
  return sabpracticeTimeLogsApi.getById(id);
}

/**
 * Primary entry point for logging time against a task.
 */
export async function logSabpracticeTime(input: SabPracticeTimeLogCreateInput) {
  const user = await requireUser();
  const payload: SabPracticeTimeLogCreateInput = {
    ...input,
    loggerUserId: input.loggerUserId || String(user._id),
  };
  const res = await sabpracticeTimeLogsApi.create(payload);
  revalidatePath('/dashboard/sabpractice/time');
  revalidateClient(input.clientId);
  return res;
}

export async function updateSabpracticeTimeLog(id: string, patch: SabPracticeTimeLogUpdateInput) {
  await requireUser();
  const res = await sabpracticeTimeLogsApi.update(id, patch);
  revalidatePath('/dashboard/sabpractice/time');
  return res;
}

export async function deleteSabpracticeTimeLog(id: string) {
  await requireUser();
  const res = await sabpracticeTimeLogsApi.delete(id);
  revalidatePath('/dashboard/sabpractice/time');
  return res;
}

// ── Advisory Notes ──────────────────────────────────────────────────

export async function listSabpracticeAdvisoryNotes(params?: {
  q?: string;
  page?: number;
  limit?: number;
  status?: string;
  kind?: string;
  clientId?: string;
}) {
  await requireUser();
  try {
    return await sabpracticeAdvisoryNotesApi.list({
      q: params?.q,
      page: params?.page,
      limit: params?.limit,
      filter: {
        status: params?.status,
        kind: params?.kind,
        clientId: params?.clientId,
      },
    });
  } catch (err) {
    if (err instanceof RustApiError) {
      console.error('[sabpractice] listAdvisoryNotes failed:', err.message);
      return emptyList();
    }
    throw err;
  }
}

export async function getSabpracticeAdvisoryNote(id: string) {
  await requireUser();
  return sabpracticeAdvisoryNotesApi.getById(id);
}

export async function createSabpracticeAdvisoryNote(input: SabPracticeAdvisoryNoteCreateInput) {
  const user = await requireUser();
  const payload: SabPracticeAdvisoryNoteCreateInput = {
    ...input,
    authorUserId: input.authorUserId || String(user._id),
  };
  const res = await sabpracticeAdvisoryNotesApi.create(payload);
  revalidateClient(input.clientId);
  return res;
}

export async function updateSabpracticeAdvisoryNote(
  id: string,
  patch: SabPracticeAdvisoryNoteUpdateInput,
) {
  await requireUser();
  const res = await sabpracticeAdvisoryNotesApi.update(id, patch);
  revalidateRoot();
  return res;
}

export async function deleteSabpracticeAdvisoryNote(id: string) {
  await requireUser();
  const res = await sabpracticeAdvisoryNotesApi.delete(id);
  revalidateRoot();
  return res;
}

/**
 * Flip a draft advisory note to `shared` (visible to the client portal).
 */
export async function shareSabpracticeAdvisoryNote(id: string) {
  await requireUser();
  const res = await sabpracticeAdvisoryNotesApi.share(id);
  revalidateClient(res?.clientId);
  return res;
}

// ── Deadlines ───────────────────────────────────────────────────────

export async function listSabpracticeDeadlines(params?: {
  q?: string;
  page?: number;
  limit?: number;
  status?: string;
  kind?: string;
  clientId?: string;
  from?: string;
  to?: string;
}) {
  await requireUser();
  try {
    return await sabpracticeDeadlinesApi.list({
      q: params?.q,
      page: params?.page,
      limit: params?.limit,
      filter: {
        status: params?.status,
        kind: params?.kind,
        clientId: params?.clientId,
        from: params?.from,
        to: params?.to,
      },
    });
  } catch (err) {
    if (err instanceof RustApiError) {
      console.error('[sabpractice] listDeadlines failed:', err.message);
      return emptyList();
    }
    throw err;
  }
}

export async function getSabpracticeDeadline(id: string) {
  await requireUser();
  return sabpracticeDeadlinesApi.getById(id);
}

export async function createSabpracticeDeadline(input: SabPracticeDeadlineCreateInput) {
  await requireUser();
  const res = await sabpracticeDeadlinesApi.create(input);
  revalidatePath('/dashboard/sabpractice/deadlines');
  revalidateClient(input.clientId);
  return res;
}

export async function updateSabpracticeDeadline(id: string, patch: SabPracticeDeadlineUpdateInput) {
  await requireUser();
  const res = await sabpracticeDeadlinesApi.update(id, patch);
  revalidatePath('/dashboard/sabpractice/deadlines');
  return res;
}

export async function deleteSabpracticeDeadline(id: string) {
  await requireUser();
  const res = await sabpracticeDeadlinesApi.delete(id);
  revalidatePath('/dashboard/sabpractice/deadlines');
  return res;
}

/**
 * Stamp a deadline as filed — completedAt now, optional SabFiles receipt
 * ids (`attachmentFileIds`) for the firm's records.
 */
export async function markSabpracticeDeadlineFiled(
  id: string,
  input?: SabPracticeDeadlineFileInput,
) {
  await requireUser();
  const res = await sabpracticeDeadlinesApi.file(id, input ?? {});
  revalidatePath('/dashboard/sabpractice/deadlines');
  revalidateClient(res?.clientId);
  return res;
}
