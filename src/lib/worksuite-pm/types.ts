/**
 * Worksuite Project Management — domain types.
 *
 * These are *runtime* domain types layered on top of the lower-level
 * MongoDB document types in `src/lib/worksuite/project-types.ts`. Use
 * these in services, actions, and UI; convert to/from the Mongo shape
 * at the persistence boundary.
 *
 * Multi-tenant isolation: every record carries `userId` (the tenant
 * owner). All money values are stored as plain numbers in the project
 * currency unless otherwise noted.
 */

export type ID = string;

export type ProjectStatus =
  | 'planning'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'cancelled';

export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Project {
  id: ID;
  userId: ID;
  name: string;
  shortCode?: string;
  summary?: string;
  status: ProjectStatus;
  priority?: ProjectPriority;
  startDate?: string; // ISO date
  dueDate?: string; // ISO date
  budget?: number;
  hourlyRate?: number;
  currency?: string;
  clientId?: ID;
  ownerId?: ID;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus =
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'blocked'
  | 'done'
  | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: ID;
  userId: ID;
  projectId: ID;
  sprintId?: ID;
  parentTaskId?: ID;
  milestoneId?: ID;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeIds: ID[];
  reporterId?: ID;
  startDate?: string;
  dueDate?: string;
  estimateHours?: number;
  actualHours?: number;
  storyPoints?: number;
  labels?: string[];
  /** Position within column / sprint backlog. */
  order?: number;
  /** Kanban column key (when board-driven). */
  columnId?: ID;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface Subtask {
  id: ID;
  userId: ID;
  taskId: ID;
  title: string;
  done: boolean;
  assigneeId?: ID;
  order?: number;
  createdAt: string;
  updatedAt: string;
}

export type SprintStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export interface Sprint {
  id: ID;
  userId: ID;
  projectId: ID;
  name: string;
  goal?: string;
  status: SprintStatus;
  startDate: string;
  endDate: string;
  capacityHours?: number;
  velocity?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: ID;
  userId: ID;
  projectId: ID;
  name: string;
  description?: string;
  dueDate: string;
  completed: boolean;
  cost?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: ID;
  userId: ID;
  projectId: ID;
  taskId?: ID;
  memberId: ID;
  startedAt: string;
  endedAt?: string;
  /** Duration in minutes. Computed when timer stops. */
  durationMinutes?: number;
  /** Idle minutes deducted (≥30 min idle threshold). */
  idleMinutes?: number;
  billable: boolean;
  hourlyRate?: number;
  notes?: string;
  source?: 'manual' | 'timer' | 'imported';
  createdAt: string;
  updatedAt: string;
}

export type DependencyKind =
  | 'finish_to_start'
  | 'start_to_start'
  | 'finish_to_finish'
  | 'start_to_finish';

export interface Dependency {
  id: ID;
  userId: ID;
  projectId: ID;
  /** Predecessor task id. */
  fromTaskId: ID;
  /** Successor task id. */
  toTaskId: ID;
  kind: DependencyKind;
  lagDays?: number;
  createdAt: string;
}

export interface KanbanColumn {
  id: ID;
  name: string;
  order: number;
  /** Optional WIP limit; null/undefined = no limit. */
  wipLimit?: number;
  /** Status this column maps to. */
  status: TaskStatus;
}

export interface KanbanBoard {
  id: ID;
  userId: ID;
  projectId: ID;
  name: string;
  columns: KanbanColumn[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Item used by the Gantt / critical-path engine. Decoupled from `Task`
 * so it can also represent milestones or roll-ups.
 */
export interface GanttItem {
  id: ID;
  name: string;
  /** Duration in days. Use 0 for milestones. */
  durationDays: number;
  /** Predecessor item ids — must reference items in the same array. */
  dependsOn: ID[];
  /** Optional pinned earliest start (days from project start). */
  earliestStart?: number;
}

export interface ResourceAllocation {
  id: ID;
  userId: ID;
  resourceId: ID;
  projectId?: ID;
  taskId?: ID;
  /** ISO datetime range. */
  start: string;
  end: string;
  /** Hours per day allocated within the slot. */
  hoursPerDay: number;
  notes?: string;
  createdAt: string;
}

export interface ClientPortalSession {
  /** Random token id (jti). */
  id: ID;
  userId: ID;
  projectId: ID;
  clientId: ID;
  /** Branded subdomain — e.g. `acme.clients.sabnode.com`. */
  subdomain: string;
  /** Signed JWT issued via `jose`. */
  token: string;
  expiresAt: string;
  scopes: ('view_project' | 'view_invoices' | 'comment' | 'approve')[];
  createdAt: string;
}

export type BillingModel = 'fixed_fee' | 'time_and_materials' | 'retainer';

export interface ContractBilling {
  id: ID;
  userId: ID;
  projectId: ID;
  clientId: ID;
  model: BillingModel;
  currency: string;
  /** Fixed-fee total. */
  fixedFee?: number;
  /** T&M default hourly rate. */
  hourlyRate?: number;
  /** Retainer amount per period. */
  retainerAmount?: number;
  /** monthly | weekly — only for retainer. */
  retainerCadence?: 'weekly' | 'monthly';
  /** Capped retainer hours. */
  retainerCapHours?: number;
  startDate: string;
  endDate?: string;
  /** Free-form schedule rules (e.g. milestone payouts). */
  scheduleRules?: BillingScheduleRule[];
  createdAt: string;
  updatedAt: string;
}

export interface BillingScheduleRule {
  /** When to bill — milestone, fixed date, or recurring. */
  trigger: 'milestone' | 'date' | 'recurring';
  milestoneId?: ID;
  date?: string;
  /** For recurring: cadence in days. */
  everyDays?: number;
  amount?: number;
  /** Percentage of fixedFee — alternative to amount. */
  percent?: number;
  description?: string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Domain events (emitted via `tasks.ts` etc.)
 * ══════════════════════════════════════════════════════════════════ */

export interface TaskCreatedEvent {
  type: 'task.created';
  task: Task;
  at: string;
}

export interface TaskStatusChangedEvent {
  type: 'task.status_changed';
  taskId: ID;
  projectId: ID;
  from: TaskStatus;
  to: TaskStatus;
  at: string;
  by?: ID;
}

export interface TaskAssigneeChangedEvent {
  type: 'task.assignee_changed';
  taskId: ID;
  projectId: ID;
  added: ID[];
  removed: ID[];
  at: string;
  by?: ID;
}

export type WorksuiteEvent =
  | TaskCreatedEvent
  | TaskStatusChangedEvent
  | TaskAssigneeChangedEvent;
