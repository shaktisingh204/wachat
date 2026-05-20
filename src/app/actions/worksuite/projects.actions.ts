'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import {
  hrList,
  hrGetById,
  hrSave,
  hrDelete,
  hrBulkDelete,
  formToObject,
  requireSession,
} from '@/lib/hr-crud';
import { connectToDatabase } from '@/lib/mongodb';
import { isDateBefore } from '@/lib/form-validation';
import type {
  WsProject,
  WsProjectMember,
  WsProjectMilestone,
  WsProjectFile,
  WsProjectNote,
  WsProjectRating,
  WsProjectActivity,
  WsProjectLabelList,
  WsProjectLabel,
  WsProjectCategory,
  WsProjectSubCategory,
  WsProjectDepartment,
  WsTask,
  WsSubTask,
  WsTaskCategory,
  WsTaskComment,
  WsTaskFile,
  WsTaskHistory,
  WsTaskLabelList,
  WsTaskLabel,
  WsTaskNote,
  WsTaskTagList,
  WsTaskTag,
  WsTaskUser,
  WsTaskboardColumn,
  WsIssue,
  WsGanttLink,
  WsPinned,
} from '@/lib/worksuite/project-types';

/**
 * Worksuite Project Management — CRUD server actions.
 *
 * Every entity follows the same shape (see `hr.actions.ts`):
 *   get<E>s()                — list for the tenant
 *   get<E>ById(id)           — single fetch
 *   save<E>(prev, formData)  — insert/update via action state
 *   delete<E>(id)            — remove
 *
 * Collections are prefixed `crm_*` (matching existing SabNode CRM data).
 */

type FormState = { message?: string; error?: string; id?: string };

async function genericSave(
  collection: string,
  revalidate: string,
  formData: FormData,
  options: {
    idFields?: string[];
    dateFields?: string[];
    numericKeys?: string[];
    jsonKeys?: string[];
  } = {},
): Promise<FormState> {
  try {
    const data = formToObject(formData, options.numericKeys || []);
    if (isDateBefore(data, 'startDate', 'endDate')) {
      return { error: 'End date cannot be before start date.' };
    }
    if (isDateBefore(data, 'startDate', 'deadline')) {
      return { error: 'Deadline cannot be before start date.' };
    }
    if (isDateBefore(data, 'startDate', 'dueDate')) {
      return { error: 'Due date cannot be before start date.' };
    }
    for (const k of options.jsonKeys || []) {
      if (typeof data[k] === 'string' && data[k]) {
        try {
          data[k] = JSON.parse(data[k]);
        } catch {
          /* leave as string */
        }
      }
    }
    const res = await hrSave(collection, data, {
      idFields: options.idFields,
      dateFields: options.dateFields,
    });
    if (res.error) return { error: res.error };
    revalidatePath(revalidate);
    return { message: 'Saved successfully.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save' };
  }
}

/* ═══════════════════════════════════════════════════════════════════
 *  Projects
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsProjects() {
  return hrList<WsProject>('crm_projects');
}
export async function getWsProjectById(id: string) {
  return hrGetById<WsProject>('crm_projects', id);
}
export async function saveWsProject(_prev: any, formData: FormData) {
  return genericSave('crm_projects', '/dashboard/crm/projects', formData, {
    idFields: [
      'clientId',
      'categoryId',
      'subCategoryId',
      'departmentId',
      'teamId',
      'projectAdmin',
      'currencyId',
    ],
    dateFields: ['startDate', 'deadline', 'endDate'],
    numericKeys: [
      'completionPercent',
      'progress',
      'projectBudget',
      'budget',
      'hoursAllocated',
      'public',
      'clientAccess',
      'enableMiroboard',
      'membersCount',
      'tasksCount',
      'milestonesCount',
    ],
    jsonKeys: ['labelIds'],
  });
}
export async function deleteWsProject(id: string) {
  const r = await hrDelete('crm_projects', id);
  revalidatePath('/dashboard/crm/projects');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Project Members
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsProjectMembers() {
  return hrList<WsProjectMember>('crm_project_members');
}
export async function getWsProjectMembersByProject(projectId: string) {
  return hrList<WsProjectMember>('crm_project_members', {
    extraFilter: { projectId },
  });
}
export async function getWsProjectMemberById(id: string) {
  return hrGetById<WsProjectMember>('crm_project_members', id);
}
export async function saveWsProjectMember(_prev: any, formData: FormData) {
  return genericSave('crm_project_members', '/dashboard/crm/projects', formData, {
    idFields: ['projectId', 'memberUserId'],
    numericKeys: ['hourlyRate'],
  });
}
export async function deleteWsProjectMember(id: string) {
  const r = await hrDelete('crm_project_members', id);
  revalidatePath('/dashboard/crm/projects');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Project Milestones
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsProjectMilestones() {
  return hrList<WsProjectMilestone>('crm_project_milestones');
}
export async function getWsProjectMilestonesByProject(projectId: string) {
  return hrList<WsProjectMilestone>('crm_project_milestones', {
    extraFilter: { projectId },
  });
}
export async function getWsProjectMilestoneById(id: string) {
  return hrGetById<WsProjectMilestone>('crm_project_milestones', id);
}
export async function saveWsProjectMilestone(_prev: any, formData: FormData) {
  return genericSave(
    'crm_project_milestones',
    '/dashboard/crm/projects/milestones',
    formData,
    {
      idFields: ['projectId', 'invoiceId'],
      dateFields: ['startDate', 'endDate'],
      numericKeys: ['cost', 'invoiceCreated'],
    },
  );
}
export async function deleteWsProjectMilestone(id: string) {
  const r = await hrDelete('crm_project_milestones', id);
  revalidatePath('/dashboard/crm/projects/milestones');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Project Files
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsProjectFiles() {
  return hrList<WsProjectFile>('crm_project_files');
}
export async function getWsProjectFilesByProject(projectId: string) {
  return hrList<WsProjectFile>('crm_project_files', {
    extraFilter: { projectId },
  });
}
export async function saveWsProjectFile(_prev: any, formData: FormData) {
  return genericSave('crm_project_files', '/dashboard/crm/projects', formData, {
    idFields: ['projectId'],
  });
}
export async function deleteWsProjectFile(id: string) {
  const r = await hrDelete('crm_project_files', id);
  revalidatePath('/dashboard/crm/projects');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Project Notes
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsProjectNotes() {
  return hrList<WsProjectNote>('crm_project_notes');
}
export async function getWsProjectNotesByProject(projectId: string) {
  return hrList<WsProjectNote>('crm_project_notes', {
    extraFilter: { projectId },
  });
}
export async function saveWsProjectNote(_prev: any, formData: FormData) {
  return genericSave('crm_project_notes', '/dashboard/crm/projects', formData, {
    idFields: ['projectId', 'clientId'],
    numericKeys: ['type', 'isClientShow', 'askPassword'],
  });
}
export async function deleteWsProjectNote(id: string) {
  const r = await hrDelete('crm_project_notes', id);
  revalidatePath('/dashboard/crm/projects');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Project Ratings
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsProjectRatings() {
  return hrList<WsProjectRating>('crm_project_ratings');
}
export async function saveWsProjectRating(_prev: any, formData: FormData) {
  return genericSave('crm_project_ratings', '/dashboard/crm/projects', formData, {
    idFields: ['projectId', 'ratedByUserId'],
    numericKeys: ['rating'],
  });
}
export async function deleteWsProjectRating(id: string) {
  const r = await hrDelete('crm_project_ratings', id);
  revalidatePath('/dashboard/crm/projects');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Project Activity
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsProjectActivities() {
  return hrList<WsProjectActivity>('crm_project_activities');
}
export async function getWsProjectActivitiesByProject(projectId: string) {
  return hrList<WsProjectActivity>('crm_project_activities', {
    extraFilter: { projectId },
  });
}
export async function saveWsProjectActivity(_prev: any, formData: FormData) {
  return genericSave(
    'crm_project_activities',
    '/dashboard/crm/projects/activity',
    formData,
    { idFields: ['projectId', 'actorUserId'] },
  );
}
export async function deleteWsProjectActivity(id: string) {
  const r = await hrDelete('crm_project_activities', id);
  revalidatePath('/dashboard/crm/projects/activity');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Project Labels (label list + pivot)
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsProjectLabels() {
  return hrList<WsProjectLabelList>('crm_project_labels');
}
export async function saveWsProjectLabel(_prev: any, formData: FormData) {
  return genericSave(
    'crm_project_labels',
    '/dashboard/crm/projects/labels',
    formData,
  );
}
export async function deleteWsProjectLabel(id: string) {
  const r = await hrDelete('crm_project_labels', id);
  revalidatePath('/dashboard/crm/projects/labels');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Project Categories + Sub-categories
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsProjectCategories() {
  return hrList<WsProjectCategory>('crm_project_categories');
}
export async function saveWsProjectCategory(_prev: any, formData: FormData) {
  return genericSave(
    'crm_project_categories',
    '/dashboard/crm/projects/categories',
    formData,
  );
}
export async function deleteWsProjectCategory(id: string) {
  const r = await hrDelete('crm_project_categories', id);
  revalidatePath('/dashboard/crm/projects/categories');
  return r;
}

export async function getWsProjectSubCategories() {
  return hrList<WsProjectSubCategory>('crm_project_sub_categories');
}
export async function saveWsProjectSubCategory(_prev: any, formData: FormData) {
  return genericSave(
    'crm_project_sub_categories',
    '/dashboard/crm/projects/categories',
    formData,
    { idFields: ['parentCategoryId'] },
  );
}
export async function deleteWsProjectSubCategory(id: string) {
  const r = await hrDelete('crm_project_sub_categories', id);
  revalidatePath('/dashboard/crm/projects/categories');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Project Departments
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsProjectDepartments() {
  return hrList<WsProjectDepartment>('crm_project_departments');
}
export async function saveWsProjectDepartment(_prev: any, formData: FormData) {
  return genericSave(
    'crm_project_departments',
    '/dashboard/crm/projects',
    formData,
    { idFields: ['projectId', 'teamId'] },
  );
}
export async function deleteWsProjectDepartment(id: string) {
  const r = await hrDelete('crm_project_departments', id);
  revalidatePath('/dashboard/crm/projects');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Tasks
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsTasks() {
  return hrList<WsTask>('crm_tasks');
}
export async function getWsTasksByProject(projectId: string) {
  return hrList<WsTask>('crm_tasks', { extraFilter: { projectId } });
}
export async function getWsTaskById(id: string) {
  return hrGetById<WsTask>('crm_tasks', id);
}
export async function saveWsTask(_prev: any, formData: FormData) {
  return genericSave('crm_tasks', '/dashboard/crm/projects', formData, {
    idFields: [
      'projectId',
      'taskCategoryId',
      'boardColumnId',
      'milestoneId',
      'createdBy',
      'dependentTaskId',
      'recurringTaskId',
    ],
    dateFields: ['startDate', 'dueDate', 'completedOn'],
    numericKeys: [
      'columnPriority',
      'isPrivate',
      'billable',
      'estimateHours',
      'estimateMinutes',
      'estimatedHours',
      'actualHours',
      'repeat',
      'repeatComplete',
      'repeatCount',
      'repeatCycles',
    ],
    jsonKeys: ['assigneeIds'],
  });
}
export async function deleteWsTask(id: string) {
  const r = await hrDelete('crm_tasks', id);
  revalidatePath('/dashboard/crm/projects');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Sub-Tasks
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsSubTasks() {
  return hrList<WsSubTask>('crm_sub_tasks');
}
export async function getWsSubTasksByTask(taskId: string) {
  return hrList<WsSubTask>('crm_sub_tasks', { extraFilter: { taskId } });
}
export async function saveWsSubTask(_prev: any, formData: FormData) {
  return genericSave('crm_sub_tasks', '/dashboard/crm/projects/subtasks', formData, {
    idFields: ['taskId', 'projectId', 'assignedTo'],
    dateFields: ['startDate', 'dueDate'],
  });
}
export async function deleteWsSubTask(id: string) {
  const r = await hrDelete('crm_sub_tasks', id);
  revalidatePath('/dashboard/crm/projects/subtasks');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Task Categories
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsTaskCategories() {
  return hrList<WsTaskCategory>('crm_task_categories');
}
export async function saveWsTaskCategory(_prev: any, formData: FormData) {
  return genericSave(
    'crm_task_categories',
    '/dashboard/crm/projects/task-categories',
    formData,
  );
}
export async function deleteWsTaskCategory(id: string) {
  const r = await hrDelete('crm_task_categories', id);
  revalidatePath('/dashboard/crm/projects/task-categories');
  return r;
}

export async function bulkDeleteWsTaskCategories(ids: string[]) {
  const r = await hrBulkDelete('crm_task_categories', ids);
  revalidatePath('/dashboard/crm/projects/task-categories');
  return r;
}

export interface WsTaskCategoryKpis {
  total: number;
  inUse: number;
  unused: number;
  lastAddedAt: string | null;
}

export async function getWsTaskCategoryKpis(): Promise<WsTaskCategoryKpis> {
  const user = await requireSession();
  if (!user) return { total: 0, inUse: 0, unused: 0, lastAddedAt: null };
  const { db } = await connectToDatabase();
  const userObjectId = new ObjectId(user._id);
  const collection = 'crm_task_categories';

  const total = await db
    .collection(collection)
    .countDocuments({ userId: userObjectId });

  const latest = await db
    .collection(collection)
    .find({ userId: userObjectId })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();
  const lastAddedAt =
    latest[0]?.createdAt instanceof Date
      ? (latest[0].createdAt as Date).toISOString()
      : latest[0]?.createdAt
        ? String(latest[0].createdAt)
        : null;

  let inUse = 0;
  try {
    const ids = await db.collection('crm_tasks').distinct('taskCategoryId', {
      userId: userObjectId,
      taskCategoryId: { $exists: true, $ne: null },
    });
    const seen = new Set<string>();
    for (const v of ids as unknown[]) {
      if (v == null) continue;
      seen.add(String(v));
    }
    inUse = seen.size;
  } catch {
    inUse = 0;
  }

  return { total, inUse, unused: Math.max(0, total - inUse), lastAddedAt };
}

/* ═══════════════════════════════════════════════════════════════════
 *  Task Comments
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsTaskComments() {
  return hrList<WsTaskComment>('crm_task_comments');
}
export async function getWsTaskCommentsByTask(taskId: string) {
  return hrList<WsTaskComment>('crm_task_comments', { extraFilter: { taskId } });
}
export async function saveWsTaskComment(_prev: any, formData: FormData) {
  return genericSave('crm_task_comments', '/dashboard/crm/projects', formData, {
    idFields: ['taskId', 'commentByUserId'],
  });
}
export async function deleteWsTaskComment(id: string) {
  const r = await hrDelete('crm_task_comments', id);
  revalidatePath('/dashboard/crm/projects');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Task Files
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsTaskFiles() {
  return hrList<WsTaskFile>('crm_task_files');
}
export async function getWsTaskFilesByTask(taskId: string) {
  return hrList<WsTaskFile>('crm_task_files', { extraFilter: { taskId } });
}
export async function saveWsTaskFile(_prev: any, formData: FormData) {
  return genericSave('crm_task_files', '/dashboard/crm/projects', formData, {
    idFields: ['taskId'],
  });
}
export async function deleteWsTaskFile(id: string) {
  const r = await hrDelete('crm_task_files', id);
  revalidatePath('/dashboard/crm/projects');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Task History
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsTaskHistory() {
  return hrList<WsTaskHistory>('crm_task_history');
}
export async function getWsTaskHistoryByTask(taskId: string) {
  return hrList<WsTaskHistory>('crm_task_history', { extraFilter: { taskId } });
}
export async function saveWsTaskHistory(_prev: any, formData: FormData) {
  return genericSave('crm_task_history', '/dashboard/crm/projects', formData, {
    idFields: ['taskId', 'subTaskId', 'actorUserId', 'boardColumnId'],
  });
}
export async function deleteWsTaskHistory(id: string) {
  const r = await hrDelete('crm_task_history', id);
  revalidatePath('/dashboard/crm/projects');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Task Labels
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsTaskLabels() {
  return hrList<WsTaskLabelList>('crm_task_labels');
}
export async function saveWsTaskLabel(_prev: any, formData: FormData) {
  return genericSave(
    'crm_task_labels',
    '/dashboard/crm/projects/task-labels',
    formData,
    { idFields: ['projectId'] },
  );
}
export async function deleteWsTaskLabel(id: string) {
  const r = await hrDelete('crm_task_labels', id);
  revalidatePath('/dashboard/crm/projects/task-labels');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Task Notes
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsTaskNotes() {
  return hrList<WsTaskNote>('crm_task_notes');
}
export async function getWsTaskNotesByTask(taskId: string) {
  return hrList<WsTaskNote>('crm_task_notes', { extraFilter: { taskId } });
}
export async function saveWsTaskNote(_prev: any, formData: FormData) {
  return genericSave('crm_task_notes', '/dashboard/crm/projects', formData, {
    idFields: ['taskId', 'authorUserId'],
  });
}
export async function deleteWsTaskNote(id: string) {
  const r = await hrDelete('crm_task_notes', id);
  revalidatePath('/dashboard/crm/projects');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Task Tags
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsTaskTags() {
  return hrList<WsTaskTagList>('crm_task_tags');
}
export async function saveWsTaskTag(_prev: any, formData: FormData) {
  return genericSave(
    'crm_task_tags',
    '/dashboard/crm/projects/task-tags',
    formData,
  );
}
export async function deleteWsTaskTag(id: string) {
  const r = await hrDelete('crm_task_tags', id);
  revalidatePath('/dashboard/crm/projects/task-tags');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Task Users (assignees — pivot)
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsTaskUsers() {
  return hrList<WsTaskUser>('crm_task_users');
}
export async function getWsTaskUsersByTask(taskId: string) {
  return hrList<WsTaskUser>('crm_task_users', { extraFilter: { taskId } });
}
export async function saveWsTaskUser(_prev: any, formData: FormData) {
  return genericSave('crm_task_users', '/dashboard/crm/projects', formData, {
    idFields: ['taskId', 'memberUserId'],
  });
}
export async function deleteWsTaskUser(id: string) {
  const r = await hrDelete('crm_task_users', id);
  revalidatePath('/dashboard/crm/projects');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Taskboard Columns
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsTaskboardColumns() {
  return hrList<WsTaskboardColumn>('crm_taskboard_columns', {
    sortBy: { priority: 1 },
  });
}
export async function saveWsTaskboardColumn(_prev: any, formData: FormData) {
  return genericSave(
    'crm_taskboard_columns',
    '/dashboard/crm/projects/taskboard-columns',
    formData,
    { numericKeys: ['priority'] },
  );
}
export async function deleteWsTaskboardColumn(id: string) {
  const r = await hrDelete('crm_taskboard_columns', id);
  revalidatePath('/dashboard/crm/projects/taskboard-columns');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Issues
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsIssues() {
  return hrList<WsIssue>('crm_issues');
}
export async function saveWsIssue(_prev: any, formData: FormData) {
  // Normalise picker field names (reporterId / assigneeId from the new
  // sectioned form) onto the legacy column names the doc stores under.
  const fd = new FormData();
  for (const [k, v] of formData.entries()) {
    // Drop ephemeral subtask-row picker fields — only the consolidated
    // `subtasks` JSON should reach the DB.
    if (k.startsWith('__subtaskAssignee-')) continue;
    fd.append(k, v);
  }
  if (!fd.get('reporterUserId') && fd.get('reporterId')) {
    fd.set('reporterUserId', String(fd.get('reporterId') ?? ''));
  }
  if (!fd.get('assigneeUserId') && fd.get('assigneeId')) {
    fd.set('assigneeUserId', String(fd.get('assigneeId') ?? ''));
  }
  return genericSave('crm_issues', '/dashboard/crm/projects/issues', fd, {
    idFields: ['projectId', 'reporterUserId', 'assigneeUserId'],
    dateFields: ['dueDate'],
    numericKeys: ['estimatedHours'],
    jsonKeys: ['subtasks', 'attachments'],
  });
}
export async function deleteWsIssue(id: string) {
  const r = await hrDelete('crm_issues', id);
  revalidatePath('/dashboard/crm/projects/issues');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Gantt links
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsGanttLinks() {
  return hrList<WsGanttLink>('crm_gantt_links');
}
export async function getWsGanttLinksByProject(projectId: string) {
  return hrList<WsGanttLink>('crm_gantt_links', { extraFilter: { projectId } });
}
export async function saveWsGanttLink(_prev: any, formData: FormData) {
  return genericSave('crm_gantt_links', '/dashboard/crm/projects/gantt', formData, {
    idFields: ['projectId', 'source', 'target'],
  });
}
export async function deleteWsGanttLink(id: string) {
  const r = await hrDelete('crm_gantt_links', id);
  revalidatePath('/dashboard/crm/projects/gantt');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Pinned
 * ══════════════════════════════════════════════════════════════════ */

export async function getWsPinned() {
  return hrList<WsPinned>('crm_pinned');
}
export async function saveWsPinned(_prev: any, formData: FormData) {
  return genericSave('crm_pinned', '/dashboard/crm/projects', formData, {
    idFields: ['projectId', 'taskId', 'pinnedByUserId'],
  });
}
export async function deleteWsPinned(id: string) {
  const r = await hrDelete('crm_pinned', id);
  revalidatePath('/dashboard/crm/projects');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Convenience: update status helpers (used by kanban / detail pages)
 * ══════════════════════════════════════════════════════════════════ */

export async function updateWsTaskColumn(
  taskId: string,
  boardColumnId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const fd = new FormData();
    fd.set('_id', taskId);
    fd.set('boardColumnId', boardColumnId);
    const res = await saveWsTask(null, fd);
    if (res.error) return { success: false, error: res.error };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to move task' };
  }
}

/* ═══════════════════════════════════════════════════════════════════
 *  Right-rail counts (§5.6) for the project detail page.
 *  Tasks · milestones · issues · time-logs · attachments.
 *  All counts tenant-scoped (`userId`). Returns zeros on failure.
 * ══════════════════════════════════════════════════════════════════ */

export async function getCrmProjectRelatedCounts(projectId: string): Promise<{
  tasks: number;
  milestones: number;
  issues: number;
  timeLogs: number;
  attachments: number;
}> {
  const empty = { tasks: 0, milestones: 0, issues: 0, timeLogs: 0, attachments: 0 };
  if (!projectId) return empty;

  const { ObjectId } = await import('mongodb');
  const { connectToDatabase } = await import('@/lib/mongodb');
  const { getSession } = await import('@/app/actions/user.actions');

  const session = await getSession();
  if (!session?.user) return empty;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(String(session.user._id));
    const idCandidates: unknown[] = [projectId];
    if (ObjectId.isValid(projectId)) idCandidates.push(new ObjectId(projectId));

    const [tasks, milestones, issues, timeLogs, attachments] = await Promise.all([
      db
        .collection('crm_tasks')
        .countDocuments({
          userId,
          projectId: { $in: idCandidates },
        } as Record<string, unknown>)
        .catch(() => 0),
      db
        .collection('crm_project_milestones')
        .countDocuments({
          userId,
          projectId: { $in: idCandidates },
        } as Record<string, unknown>)
        .catch(() => 0),
      db
        .collection('crm_issues')
        .countDocuments({
          userId,
          projectId: { $in: idCandidates },
        } as Record<string, unknown>)
        .catch(() => 0),
      db
        .collection('crm_time_logs')
        .countDocuments({
          userId,
          projectId: { $in: idCandidates },
        } as Record<string, unknown>)
        .catch(() => 0),
      db
        .collection('crm_project_files')
        .countDocuments({
          userId,
          projectId: { $in: idCandidates },
        } as Record<string, unknown>)
        .catch(() => 0),
    ]);

    return {
      tasks: Number(tasks) || 0,
      milestones: Number(milestones) || 0,
      issues: Number(issues) || 0,
      timeLogs: Number(timeLogs) || 0,
      attachments: Number(attachments) || 0,
    };
  } catch (e) {
    console.error('[getCrmProjectRelatedCounts] failed:', e);
    return empty;
  }
}

/* ═══════════════════════════════════════════════════════════════════
 *  Bulk delete helpers — used by §1D taxonomy/activity list pages.
 *  Wrap `hrBulkDelete` (multi-tenant, single Mongo deleteMany).
 * ══════════════════════════════════════════════════════════════════ */

async function tenantBulkDelete(
  collection: string,
  revalidate: string,
  ids: string[],
): Promise<{ deleted: number; failed: number; error?: string }> {
  const r = await hrBulkDelete(collection, ids);
  revalidatePath(revalidate);
  if (!r.success) {
    return { deleted: 0, failed: ids.length, error: r.error };
  }
  return { deleted: r.deleted, failed: Math.max(0, ids.length - r.deleted) };
}

export async function bulkDeleteWsProjectLabels(ids: string[]) {
  return tenantBulkDelete('crm_project_labels', '/dashboard/crm/projects/labels', ids);
}
export async function bulkDeleteWsProjectCategories(ids: string[]) {
  return tenantBulkDelete('crm_project_categories', '/dashboard/crm/projects/categories', ids);
}
export async function bulkDeleteWsProjectSubCategories(ids: string[]) {
  return tenantBulkDelete('crm_project_sub_categories', '/dashboard/crm/projects/categories', ids);
}
export async function bulkDeleteWsTaskLabels(ids: string[]) {
  return tenantBulkDelete('crm_task_labels', '/dashboard/crm/projects/task-labels', ids);
}
export async function bulkDeleteWsTaskTags(ids: string[]) {
  return tenantBulkDelete('crm_task_tags', '/dashboard/crm/projects/task-tags', ids);
}
export async function bulkDeleteWsProjectActivities(ids: string[]) {
  return tenantBulkDelete('crm_project_activities', '/dashboard/crm/projects/activity', ids);
}

/* ── Issues bulk ops ─────────────────────────────────────────────── */

export async function bulkDeleteWsIssues(
  ids: string[],
): Promise<{ deleted: number; failed: number; error?: string }> {
  return tenantBulkDelete('crm_issues', '/dashboard/crm/projects/issues', ids);
}

export async function bulkUpdateWsIssues(
  ids: string[],
  op: 'close' | 'assign',
  payload?: { assigneeUserId?: string },
): Promise<{ updated: number; failed: number; error?: string }> {
  const user = await requireSession();
  if (!user) return { updated: 0, failed: ids.length, error: 'Access denied' };

  const oids = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (oids.length === 0) return { updated: 0, failed: ids.length, error: 'No valid IDs' };

  try {
    const { db } = await connectToDatabase();
    const filter = { _id: { $in: oids }, userId: new ObjectId(user._id) };

    let update: Record<string, unknown> = {};
    if (op === 'close') {
      update = { $set: { status: 'closed', updatedAt: new Date() } };
    } else if (op === 'assign' && payload?.assigneeUserId) {
      update = {
        $set: {
          assigneeUserId: payload.assigneeUserId,
          updatedAt: new Date(),
        },
      };
    } else {
      return { updated: 0, failed: ids.length, error: 'Invalid operation' };
    }

    const r = await db.collection('crm_issues').updateMany(filter, update);
    revalidatePath('/dashboard/crm/projects/issues');
    return {
      updated: r.modifiedCount,
      failed: Math.max(0, ids.length - r.modifiedCount),
    };
  } catch (e: any) {
    return { updated: 0, failed: ids.length, error: e?.message || 'Bulk update failed' };
  }
}

/* ── Milestones bulk ops ─────────────────────────────────────────── */

export async function bulkDeleteWsMilestones(
  ids: string[],
): Promise<{ deleted: number; failed: number; error?: string }> {
  return tenantBulkDelete('crm_project_milestones', '/dashboard/crm/projects/milestones', ids);
}

export async function bulkCompleteMilestones(
  ids: string[],
): Promise<{ updated: number; failed: number; error?: string }> {
  const user = await requireSession();
  if (!user) return { updated: 0, failed: ids.length, error: 'Access denied' };

  const oids = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (oids.length === 0) return { updated: 0, failed: ids.length, error: 'No valid IDs' };

  try {
    const { db } = await connectToDatabase();
    const r = await db.collection('crm_project_milestones').updateMany(
      { _id: { $in: oids }, userId: new ObjectId(user._id) },
      { $set: { status: 'complete', updatedAt: new Date() } },
    );
    revalidatePath('/dashboard/crm/projects/milestones');
    return {
      updated: r.modifiedCount,
      failed: Math.max(0, ids.length - r.modifiedCount),
    };
  } catch (e: any) {
    return { updated: 0, failed: ids.length, error: e?.message || 'Bulk complete failed' };
  }
}
