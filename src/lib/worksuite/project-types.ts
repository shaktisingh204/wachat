import type { ObjectId } from 'mongodb';

/**
 * Worksuite Project Management — MongoDB type definitions.
 *
 * These types are ported from the Worksuite (Laravel) schema at
 * `/Users/harshkhandelwal/Downloads/script/app/Models/`. Multi-tenant
 * isolation is via `userId` (replacing Laravel `company_id`). All
 * entities carry `_id`, `userId`, `createdAt`, `updatedAt`.
 */

export interface WsBase {
  _id?: ObjectId | string;
  userId: ObjectId | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  /** Optional actor references — mirror Laravel's added_by / last_updated_by. */
  addedBy?: ObjectId | string;
  lastUpdatedBy?: ObjectId | string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Taxonomy — Categories, Sub-categories, Departments, Labels
 * ══════════════════════════════════════════════════════════════════ */

export interface WsProjectCategory extends WsBase {
  categoryName: string;
  description?: string;
}

export interface WsProjectSubCategory extends WsBase {
  categoryName: string;
  parentCategoryId?: ObjectId | string;
  description?: string;
}

export interface WsProjectDepartment extends WsBase {
  projectId?: ObjectId | string;
  teamId?: ObjectId | string;
  departmentName: string;
}

export interface WsProjectLabelList extends WsBase {
  labelName: string;
  color?: string;
  description?: string;
}

/** Pivot between projects and labels. */
export interface WsProjectLabel extends WsBase {
  projectId: ObjectId | string;
  labelId: ObjectId | string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Project — core entity (extended with Worksuite fields)
 * ══════════════════════════════════════════════════════════════════ */

export type WsProjectStatus =
  | 'not started'
  | 'in progress'
  | 'on hold'
  | 'finished'
  | 'canceled'
  | 'planning'
  | 'active'
  | 'on-hold'
  | 'completed'
  | 'cancelled';

export type WsProjectPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface WsProject extends WsBase {
  /** Preferred name field — Worksuite: `project_name`. */
  name: string;
  projectName?: string;
  projectSummary?: string;
  projectShortCode?: string;
  description?: string;

  /** Short code / hash for external links. */
  hash?: string;

  /** Categorisation. */
  categoryId?: ObjectId | string;
  categoryName?: string;
  subCategoryId?: ObjectId | string;
  subCategoryName?: string;
  departmentId?: ObjectId | string;
  departmentName?: string;

  /** Client. */
  clientId?: ObjectId | string;
  clientName?: string;

  /** Team / admin. */
  teamId?: ObjectId | string;
  projectAdmin?: ObjectId | string;
  managerName?: string;

  /** Labels (list of label list ids for convenience). */
  labelIds?: (ObjectId | string)[];

  /** Dates. */
  startDate?: Date | string;
  deadline?: Date | string;
  /** Alias used by earlier SabNode schema. */
  endDate?: Date | string;

  /** Status & priority. */
  status: WsProjectStatus;
  priority?: WsProjectPriority;

  /** Progress / completion. */
  completionPercent?: number;
  /** Alias kept for the simpler existing schema. */
  progress?: number;
  calculateTaskProgress?: 'yes' | 'no';

  /** Budget. */
  currency?: string;
  currencyId?: ObjectId | string;
  projectBudget?: number;
  /** Alias used by existing schema. */
  budget?: number;
  hoursAllocated?: number;

  /** Client-facing options. */
  manualTimelog?: 'enable' | 'disable';
  clientViewTask?: 'enable' | 'disable';
  allowClientNotification?: 'enable' | 'disable';
  clientAccess?: number;

  /** Integrations. */
  enableMiroboard?: number;
  miroBoardId?: string;

  /** Access / visibility. */
  public?: number;

  /** Feedback / notes (short string, for richer use WsProjectNote). */
  feedback?: string;
  notes?: string;

  /** Derived counts (denormalised for list UIs). */
  membersCount?: number;
  tasksCount?: number;
  milestonesCount?: number;

  /** Soft-delete marker. */
  deletedAt?: Date | string | null;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Project sub-entities
 * ══════════════════════════════════════════════════════════════════ */

export interface WsProjectMember extends WsBase {
  projectId: ObjectId | string;
  memberUserId: ObjectId | string;
  memberName?: string;
  memberEmail?: string;
  hourlyRate?: number;
  role?: string;
}

export type WsMilestoneStatus = 'incomplete' | 'complete';

export interface WsProjectMilestone extends WsBase {
  projectId: ObjectId | string;
  milestoneTitle: string;
  summary?: string;
  cost?: number;
  currency?: string;
  status: WsMilestoneStatus;
  startDate?: Date | string;
  endDate?: Date | string;
  invoiceCreated?: number;
  invoiceId?: ObjectId | string;
}

export interface WsProjectFile extends WsBase {
  projectId: ObjectId | string;
  filename: string;
  hashname?: string;
  size?: string;
  description?: string;
  googleUrl?: string;
  dropboxLink?: string;
  externalLink?: string;
  externalLinkName?: string;
  /** Stored URL (SabNode simplified — no local file storage). */
  url?: string;
}

export interface WsProjectNote extends WsBase {
  projectId: ObjectId | string;
  title: string;
  details?: string;
  type?: number;
  clientId?: ObjectId | string;
  isClientShow?: number;
  askPassword?: number;
}

export interface WsProjectRating extends WsBase {
  projectId: ObjectId | string;
  rating: number;
  comment?: string;
  ratedByUserId?: ObjectId | string;
}

export interface WsProjectActivity extends WsBase {
  projectId: ObjectId | string;
  activity: string;
  actorUserId?: ObjectId | string;
  actorName?: string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Tasks
 * ══════════════════════════════════════════════════════════════════ */

export type WsTaskStatus =
  | 'incomplete'
  | 'completed'
  | 'todo'
  | 'in-progress'
  | 'review'
  | 'done';

export interface WsTask extends WsBase {
  projectId?: ObjectId | string;
  projectName?: string;

  heading: string;
  description?: string;

  taskCategoryId?: ObjectId | string;
  taskCategoryName?: string;

  startDate?: Date | string;
  dueDate?: Date | string;
  completedOn?: Date | string;

  priority: WsProjectPriority;
  status: WsTaskStatus;

  /** Taskboard column reference. */
  boardColumnId?: ObjectId | string;
  columnPriority?: number;

  milestoneId?: ObjectId | string;

  /** Assignees (denormalised summary — full list in WsTaskUser). */
  assigneeIds?: (ObjectId | string)[];
  assigneeName?: string;

  createdBy?: ObjectId | string;
  dependentTaskId?: ObjectId | string;
  recurringTaskId?: ObjectId | string;

  isPrivate?: number;
  billable?: number;

  estimateHours?: number;
  estimateMinutes?: number;
  estimatedHours?: number;
  actualHours?: number;

  hash?: string;
  taskShortCode?: string;
  eventId?: string;

  /** Recurrence. */
  repeat?: number;
  repeatComplete?: number;
  repeatCount?: number;
  repeatType?: string;
  repeatCycles?: number;

  deletedAt?: Date | string | null;
}

export interface WsSubTask extends WsBase {
  taskId: ObjectId | string;
  projectId?: ObjectId | string;
  title: string;
  description?: string;
  startDate?: Date | string;
  dueDate?: Date | string;
  status: WsTaskStatus;
  assignedTo?: ObjectId | string;
  assignedToName?: string;
}

export interface WsTaskCategory extends WsBase {
  categoryName: string;
}

export interface WsTaskComment extends WsBase {
  taskId: ObjectId | string;
  comment: string;
  commentByUserId?: ObjectId | string;
  commentByName?: string;
}

export interface WsTaskFile extends WsBase {
  taskId: ObjectId | string;
  filename: string;
  hashname?: string;
  size?: string;
  description?: string;
  googleUrl?: string;
  dropboxLink?: string;
  externalLink?: string;
  externalLinkName?: string;
  url?: string;
}

export interface WsTaskHistory extends WsBase {
  taskId: ObjectId | string;
  subTaskId?: ObjectId | string;
  actorUserId?: ObjectId | string;
  actorName?: string;
  details: string;
  boardColumnId?: ObjectId | string;
}

export interface WsTaskLabelList extends WsBase {
  labelName: string;
  color?: string;
  description?: string;
  projectId?: ObjectId | string;
}

export interface WsTaskLabel extends WsBase {
  taskId: ObjectId | string;
  labelId: ObjectId | string;
}

export interface WsTaskNote extends WsBase {
  taskId: ObjectId | string;
  note: string;
  authorUserId?: ObjectId | string;
  authorName?: string;
}

export interface WsTaskTagList extends WsBase {
  tagName: string;
  color?: string;
}

export interface WsTaskTag extends WsBase {
  taskId: ObjectId | string;
  tagId: ObjectId | string;
}

export interface WsTaskUser extends WsBase {
  taskId: ObjectId | string;
  memberUserId: ObjectId | string;
  memberName?: string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Taskboard
 * ══════════════════════════════════════════════════════════════════ */

export interface WsTaskboardColumn extends WsBase {
  columnName: string;
  slug?: string;
  labelColor: string;
  priority: number;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Issues
 * ══════════════════════════════════════════════════════════════════ */

export type WsIssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type WsIssuePriority = WsProjectPriority;

export interface WsIssue extends WsBase {
  projectId?: ObjectId | string;
  title: string;
  description?: string;
  status: WsIssueStatus;
  priority?: WsIssuePriority;
  reporterUserId?: ObjectId | string;
  reporterName?: string;
  assigneeUserId?: ObjectId | string;
  assigneeName?: string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Gantt links (task dependencies)
 * ══════════════════════════════════════════════════════════════════ */

export type WsGanttLinkType = '0' | '1' | '2' | '3' | 'FS' | 'SS' | 'FF' | 'SF';

export interface WsGanttLink extends WsBase {
  projectId?: ObjectId | string;
  /** Source task id. */
  source: ObjectId | string;
  /** Target task id. */
  target: ObjectId | string;
  type: WsGanttLinkType;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Pinned — user-pinned projects/tasks
 * ══════════════════════════════════════════════════════════════════ */

export interface WsPinned extends WsBase {
  projectId?: ObjectId | string;
  taskId?: ObjectId | string;
  pinnedByUserId: ObjectId | string;
}
