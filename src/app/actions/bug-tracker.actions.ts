'use server';

/**
 * SabBugs — server actions.
 *
 * Thin shims over the Rust BFF. Five domains are exposed:
 *   • Bugs        → `sabbugsBugsApi`
 *   • Versions    → `sabbugsVersionsApi`
 *   • Comments    → `sabbugsCommentsApi`
 *   • History     → `sabbugsHistoryApi`  (read mostly; auto-written on bug update)
 *   • Filters     → `sabbugsSavedFiltersApi`
 *
 * History is auto-logged for status / assignee / severity / priority / version
 * transitions inside `updateBug()` so the change-log fills itself with no UI
 * plumbing required.
 *
 * Project model is **reused** — the bug `projectId` references an existing
 * Worksuite project (`crm_projects` collection); see
 * `@/app/actions/worksuite/projects.actions` → `getWsProjects`. We do NOT
 * own / mirror the Project entity.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { RustApiError } from '@/lib/rust-client';
import {
  sabbugsBugsApi,
  type BugCreateInput,
  type BugDoc,
  type BugListParams,
  type BugUpdateInput,
} from '@/lib/rust-client/sabbugs-bugs';
import {
  sabbugsVersionsApi,
  type BugVersionCreateInput,
  type BugVersionDoc,
  type BugVersionListParams,
  type BugVersionUpdateInput,
} from '@/lib/rust-client/sabbugs-versions';
import {
  sabbugsCommentsApi,
  type BugCommentCreateInput,
  type BugCommentDoc,
  type BugCommentListParams,
  type BugCommentUpdateInput,
} from '@/lib/rust-client/sabbugs-comments';
import {
  sabbugsHistoryApi,
  type BugHistoryEntryDoc,
} from '@/lib/rust-client/sabbugs-history';
import {
  sabbugsSavedFiltersApi,
  type BugSavedFilterCreateInput,
  type BugSavedFilterDoc,
  type BugSavedFilterListParams,
  type BugSavedFilterUpdateInput,
} from '@/lib/rust-client/sabbugs-saved-filters';

const LIST_PATH = '/dashboard/sabbugs';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Bugs ───────────────────────────────────────────────────────── */

export interface BugListResult {
  bugs: BugDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  error?: string;
}

export async function listBugs(params: BugListParams = {}): Promise<BugListResult> {
  const session = await getSession();
  if (!session?.user) {
    return { bugs: [], page: 0, limit: 20, hasMore: false, error: 'Unauthorized' };
  }
  try {
    const res = await sabbugsBugsApi.list(params);
    return { bugs: res.items, page: res.page, limit: res.limit, hasMore: res.hasMore };
  } catch (e) {
    return { bugs: [], page: 0, limit: 20, hasMore: false, error: rustErr(e) };
  }
}

export async function getBug(
  id: string,
): Promise<{ bug: BugDoc | null; error?: string }> {
  if (!id) return { bug: null, error: 'Missing bug id.' };
  const session = await getSession();
  if (!session?.user) return { bug: null, error: 'Unauthorized' };
  try {
    const bug = await sabbugsBugsApi.getById(id);
    return { bug };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { bug: null, error: 'Bug not found.' };
    }
    return { bug: null, error: rustErr(e) };
  }
}

export async function createBug(
  input: BugCreateInput,
): Promise<{ id?: string; bug?: BugDoc; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };
  try {
    const res = await sabbugsBugsApi.create(input);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/board`);
    return { id: res.id, bug: res.entity };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/**
 * Update a bug. After the patch lands, diff the watched scalar fields and
 * write one `sabbugs_history` row per change so the detail page's
 * History tab fills in for free.
 */
export async function updateBug(
  id: string,
  patch: BugUpdateInput,
): Promise<{ bug?: BugDoc; error?: string }> {
  if (!id) return { error: 'Missing bug id.' };
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };

  // Fetch "before" so we can record granular history entries.
  let before: BugDoc | null = null;
  try {
    before = await sabbugsBugsApi.getById(id);
  } catch {
    // best-effort; updates still proceed.
  }

  try {
    const after = await sabbugsBugsApi.update(id, patch);

    if (before) {
      const watchedFields: (keyof BugDoc)[] = [
        'status',
        'assigneeId',
        'severity',
        'priority',
        'fixedInVersion',
        'projectId',
      ];
      await Promise.all(
        watchedFields
          .filter((k) => before![k] !== after[k])
          .map((k) =>
            sabbugsHistoryApi
              .create({
                bugId: id,
                field: String(k),
                oldValue: before![k] ?? null,
                newValue: after[k] ?? null,
              })
              .catch(() => undefined),
          ),
      );
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/board`);
    revalidatePath(`${LIST_PATH}/${id}`);
    return { bug: after };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

export async function deleteBug(
  id: string,
): Promise<{ deleted: boolean; error?: string }> {
  if (!id) return { deleted: false, error: 'Missing bug id.' };
  const session = await getSession();
  if (!session?.user) return { deleted: false, error: 'Unauthorized' };
  try {
    const res = await sabbugsBugsApi.delete(id);
    revalidatePath(LIST_PATH);
    return { deleted: res.deleted };
  } catch (e) {
    return { deleted: false, error: rustErr(e) };
  }
}

/* ─── Versions ───────────────────────────────────────────────────── */

export async function listVersions(
  params: BugVersionListParams = {},
): Promise<{ versions: BugVersionDoc[]; hasMore: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { versions: [], hasMore: false, error: 'Unauthorized' };
  try {
    const res = await sabbugsVersionsApi.list(params);
    return { versions: res.items, hasMore: res.hasMore };
  } catch (e) {
    return { versions: [], hasMore: false, error: rustErr(e) };
  }
}

export async function createVersion(
  input: BugVersionCreateInput,
): Promise<{ id?: string; version?: BugVersionDoc; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };
  try {
    const res = await sabbugsVersionsApi.create(input);
    revalidatePath(`${LIST_PATH}/versions`);
    return { id: res.id, version: res.entity };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

export async function updateVersion(
  id: string,
  patch: BugVersionUpdateInput,
): Promise<{ version?: BugVersionDoc; error?: string }> {
  if (!id) return { error: 'Missing version id.' };
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };
  try {
    const v = await sabbugsVersionsApi.update(id, patch);
    revalidatePath(`${LIST_PATH}/versions`);
    return { version: v };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

export async function deleteVersion(
  id: string,
): Promise<{ deleted: boolean; error?: string }> {
  if (!id) return { deleted: false, error: 'Missing version id.' };
  const session = await getSession();
  if (!session?.user) return { deleted: false, error: 'Unauthorized' };
  try {
    const res = await sabbugsVersionsApi.delete(id);
    revalidatePath(`${LIST_PATH}/versions`);
    return { deleted: res.deleted };
  } catch (e) {
    return { deleted: false, error: rustErr(e) };
  }
}

/* ─── Comments ───────────────────────────────────────────────────── */

export async function listComments(
  params: BugCommentListParams,
): Promise<{ comments: BugCommentDoc[]; hasMore: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { comments: [], hasMore: false, error: 'Unauthorized' };
  try {
    const res = await sabbugsCommentsApi.list(params);
    return { comments: res.items, hasMore: res.hasMore };
  } catch (e) {
    return { comments: [], hasMore: false, error: rustErr(e) };
  }
}

export async function createComment(
  input: BugCommentCreateInput,
): Promise<{ id?: string; comment?: BugCommentDoc; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };
  try {
    const res = await sabbugsCommentsApi.create(input);
    revalidatePath(`${LIST_PATH}/${input.bugId}`);
    return { id: res.id, comment: res.entity };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

export async function updateComment(
  id: string,
  patch: BugCommentUpdateInput,
  bugId?: string,
): Promise<{ comment?: BugCommentDoc; error?: string }> {
  if (!id) return { error: 'Missing comment id.' };
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };
  try {
    const c = await sabbugsCommentsApi.update(id, patch);
    if (bugId) revalidatePath(`${LIST_PATH}/${bugId}`);
    return { comment: c };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

export async function deleteComment(
  id: string,
  bugId?: string,
): Promise<{ deleted: boolean; error?: string }> {
  if (!id) return { deleted: false, error: 'Missing comment id.' };
  const session = await getSession();
  if (!session?.user) return { deleted: false, error: 'Unauthorized' };
  try {
    const res = await sabbugsCommentsApi.delete(id);
    if (bugId) revalidatePath(`${LIST_PATH}/${bugId}`);
    return { deleted: res.deleted };
  } catch (e) {
    return { deleted: false, error: rustErr(e) };
  }
}

/* ─── History ────────────────────────────────────────────────────── */

export async function listHistory(
  bugId: string,
): Promise<{ entries: BugHistoryEntryDoc[]; error?: string }> {
  if (!bugId) return { entries: [], error: 'Missing bug id.' };
  const session = await getSession();
  if (!session?.user) return { entries: [], error: 'Unauthorized' };
  try {
    const res = await sabbugsHistoryApi.list({ bugId, limit: 100 });
    return { entries: res.items };
  } catch (e) {
    return { entries: [], error: rustErr(e) };
  }
}

/* ─── Saved filters ──────────────────────────────────────────────── */

export async function listSavedFilters(
  params: BugSavedFilterListParams = {},
): Promise<{ filters: BugSavedFilterDoc[]; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { filters: [], error: 'Unauthorized' };
  try {
    const res = await sabbugsSavedFiltersApi.list(params);
    return { filters: res.items };
  } catch (e) {
    return { filters: [], error: rustErr(e) };
  }
}

export async function saveCurrentFilter(
  input: BugSavedFilterCreateInput,
): Promise<{ id?: string; filter?: BugSavedFilterDoc; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };
  try {
    const res = await sabbugsSavedFiltersApi.create(input);
    revalidatePath(LIST_PATH);
    return { id: res.id, filter: res.entity };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

export async function updateSavedFilter(
  id: string,
  patch: BugSavedFilterUpdateInput,
): Promise<{ filter?: BugSavedFilterDoc; error?: string }> {
  if (!id) return { error: 'Missing filter id.' };
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };
  try {
    const f = await sabbugsSavedFiltersApi.update(id, patch);
    revalidatePath(LIST_PATH);
    return { filter: f };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

export async function deleteSavedFilter(
  id: string,
): Promise<{ deleted: boolean; error?: string }> {
  if (!id) return { deleted: false, error: 'Missing filter id.' };
  const session = await getSession();
  if (!session?.user) return { deleted: false, error: 'Unauthorized' };
  try {
    const res = await sabbugsSavedFiltersApi.delete(id);
    revalidatePath(LIST_PATH);
    return { deleted: res.deleted };
  } catch (e) {
    return { deleted: false, error: rustErr(e) };
  }
}
