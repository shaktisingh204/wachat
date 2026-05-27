'use server';

/**
 * Scrum/Agile module — server actions.
 *
 * Thin wrappers around the Rust crates `agile-sprints`, `agile-stories`,
 * `agile-epics`, `agile-velocity`, and `agile-burndown`. Each action:
 *  - resolves the calling session (multi-tenant `userId` is enforced inside
 *    each Rust handler via `user_oid` — we still gate access here),
 *  - delegates to the Rust client,
 *  - revalidates the agile route segment on writes.
 *
 * RBAC TODO: register `agile_sprint`, `agile_story`, `agile_epic` permission
 * keys (view/create/edit/delete) once the registry batch lands, then wrap
 * mutating actions in `requirePermission(...)`.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  agileSprintsApi,
  type AgileSprintCreateInput,
  type AgileSprintDoc,
  type AgileSprintListParams,
  type AgileSprintListResponse,
  type AgileSprintUpdateInput,
} from '@/lib/rust-client/agile-sprints';
import {
  agileStoriesApi,
  type AgileStoryCreateInput,
  type AgileStoryDoc,
  type AgileStoryListParams,
  type AgileStoryListResponse,
  type AgileStoryReorderEntry,
  type AgileStoryUpdateInput,
} from '@/lib/rust-client/agile-stories';
import {
  agileEpicsApi,
  type AgileEpicCreateInput,
  type AgileEpicDoc,
  type AgileEpicListParams,
  type AgileEpicListResponse,
  type AgileEpicUpdateInput,
} from '@/lib/rust-client/agile-epics';
import {
  agileVelocityApi,
  type AgileVelocityListParams,
  type AgileVelocityListResponse,
  type AgileVelocityRecordInput,
} from '@/lib/rust-client/agile-velocity';
import {
  agileBurndownApi,
  type AgileBurndownListResponse,
  type AgileBurndownRecordInput,
} from '@/lib/rust-client/agile-burndown';

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function err(e: unknown): { ok: false; error: string } {
  if (e instanceof RustApiError) {
    return { ok: false, error: e.message };
  }
  return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
}

async function requireSession(): Promise<{ userId: string } | null> {
  const s = await getSession();
  return s?.user?._id ? { userId: String(s.user._id) } : null;
}

function revalidateProject(projectId: string): void {
  revalidatePath(`/dashboard/sabsprints/${projectId}`, 'layout');
}

/* ─── Sprints ─────────────────────────────────────────────────────────── */

export async function listSprints(
  params: AgileSprintListParams,
): Promise<ActionResult<AgileSprintListResponse>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await agileSprintsApi.list(params) };
  } catch (e) {
    return err(e);
  }
}

export async function getSprint(
  id: string,
): Promise<ActionResult<AgileSprintDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await agileSprintsApi.getById(id) };
  } catch (e) {
    return err(e);
  }
}

export async function createSprint(
  input: AgileSprintCreateInput,
): Promise<ActionResult<AgileSprintDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await agileSprintsApi.create(input);
    revalidateProject(input.projectId);
    return { ok: true, data: res.entity };
  } catch (e) {
    return err(e);
  }
}

export async function updateSprint(
  id: string,
  patch: AgileSprintUpdateInput,
  projectId: string,
): Promise<ActionResult<AgileSprintDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await agileSprintsApi.update(id, patch);
    revalidateProject(projectId);
    return { ok: true, data: res };
  } catch (e) {
    return err(e);
  }
}

export async function deleteSprint(
  id: string,
  projectId: string,
): Promise<ActionResult<{ deleted: boolean }>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await agileSprintsApi.delete(id);
    revalidateProject(projectId);
    return { ok: true, data: res };
  } catch (e) {
    return err(e);
  }
}

/** Start a sprint (`status=active`). Stamps `startedAt` on the Rust side. */
export async function startSprint(
  id: string,
  projectId: string,
): Promise<ActionResult<AgileSprintDoc>> {
  return updateSprint(id, { status: 'active' }, projectId);
}

/**
 * Complete a sprint and write a velocity snapshot.
 *
 * `plannedPoints` / `completedPoints` are computed by the caller from the
 * sprint board (sum of points per status), passed back in so we don't need
 * a join in Rust.
 */
export async function completeSprint(
  id: string,
  projectId: string,
  snapshot: {
    sprintName: string;
    plannedPoints: number;
    completedPoints: number;
  },
): Promise<ActionResult<AgileSprintDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const after = await agileSprintsApi.update(id, { status: 'completed' });
    await agileVelocityApi.record({
      projectId,
      sprintId: id,
      sprintName: snapshot.sprintName,
      plannedPoints: snapshot.plannedPoints,
      completedPoints: snapshot.completedPoints,
    });
    revalidateProject(projectId);
    return { ok: true, data: after };
  } catch (e) {
    return err(e);
  }
}

/* ─── Stories ─────────────────────────────────────────────────────────── */

export async function listStories(
  params: AgileStoryListParams,
): Promise<ActionResult<AgileStoryListResponse>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await agileStoriesApi.list(params) };
  } catch (e) {
    return err(e);
  }
}

export async function getStory(
  id: string,
): Promise<ActionResult<AgileStoryDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await agileStoriesApi.getById(id) };
  } catch (e) {
    return err(e);
  }
}

export async function createStory(
  input: AgileStoryCreateInput,
): Promise<ActionResult<AgileStoryDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await agileStoriesApi.create(input);
    revalidateProject(input.projectId);
    return { ok: true, data: res.entity };
  } catch (e) {
    return err(e);
  }
}

export async function updateStory(
  id: string,
  patch: AgileStoryUpdateInput,
  projectId: string,
): Promise<ActionResult<AgileStoryDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await agileStoriesApi.update(id, patch);
    revalidateProject(projectId);
    return { ok: true, data: res };
  } catch (e) {
    return err(e);
  }
}

export async function deleteStory(
  id: string,
  projectId: string,
): Promise<ActionResult<{ deleted: boolean }>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await agileStoriesApi.delete(id);
    revalidateProject(projectId);
    return { ok: true, data: res };
  } catch (e) {
    return err(e);
  }
}

/** Used by the board / backlog drag-drop. */
export async function reorderStories(
  items: AgileStoryReorderEntry[],
  projectId: string,
): Promise<ActionResult<{ updated: number }>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await agileStoriesApi.reorder(items);
    revalidateProject(projectId);
    return { ok: true, data: res };
  } catch (e) {
    return err(e);
  }
}

/** Convenience: move a story between sprint and backlog or change its column. */
export async function moveStory(
  id: string,
  patch: { sprintId?: string | null; status?: AgileStoryUpdateInput['status'] },
  projectId: string,
): Promise<ActionResult<AgileStoryDoc>> {
  const body: AgileStoryUpdateInput = {};
  if (patch.sprintId !== undefined) {
    body.sprintId = patch.sprintId === null ? '' : patch.sprintId;
  }
  if (patch.status) body.status = patch.status;
  return updateStory(id, body, projectId);
}

/* ─── Epics ───────────────────────────────────────────────────────────── */

export async function listEpics(
  params: AgileEpicListParams,
): Promise<ActionResult<AgileEpicListResponse>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await agileEpicsApi.list(params) };
  } catch (e) {
    return err(e);
  }
}

export async function getEpic(id: string): Promise<ActionResult<AgileEpicDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await agileEpicsApi.getById(id) };
  } catch (e) {
    return err(e);
  }
}

export async function createEpic(
  input: AgileEpicCreateInput,
): Promise<ActionResult<AgileEpicDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await agileEpicsApi.create(input);
    revalidateProject(input.projectId);
    return { ok: true, data: res.entity };
  } catch (e) {
    return err(e);
  }
}

export async function updateEpic(
  id: string,
  patch: AgileEpicUpdateInput,
  projectId: string,
): Promise<ActionResult<AgileEpicDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await agileEpicsApi.update(id, patch);
    revalidateProject(projectId);
    return { ok: true, data: res };
  } catch (e) {
    return err(e);
  }
}

export async function deleteEpic(
  id: string,
  projectId: string,
): Promise<ActionResult<{ deleted: boolean }>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await agileEpicsApi.delete(id);
    revalidateProject(projectId);
    return { ok: true, data: res };
  } catch (e) {
    return err(e);
  }
}

/* ─── Velocity + Burndown ─────────────────────────────────────────────── */

export async function listVelocity(
  params: AgileVelocityListParams,
): Promise<ActionResult<AgileVelocityListResponse>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await agileVelocityApi.list(params) };
  } catch (e) {
    return err(e);
  }
}

export async function recordVelocity(
  input: AgileVelocityRecordInput,
): Promise<ActionResult<{ ok: true }>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    await agileVelocityApi.record(input);
    revalidateProject(input.projectId);
    return { ok: true, data: { ok: true } };
  } catch (e) {
    return err(e);
  }
}

export async function listBurndown(
  sprintId: string,
): Promise<ActionResult<AgileBurndownListResponse>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await agileBurndownApi.list(sprintId) };
  } catch (e) {
    return err(e);
  }
}

export async function recordBurndownSample(
  input: AgileBurndownRecordInput,
): Promise<ActionResult<{ ok: true }>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    await agileBurndownApi.record(input);
    return { ok: true, data: { ok: true } };
  } catch (e) {
    return err(e);
  }
}
