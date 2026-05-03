/**
 * Task CRUD + status transitions + assignee changes.
 *
 * Pure, framework-agnostic. Storage is injected via `TaskStore` so the
 * same logic works against MongoDB in production and an in-memory map
 * in tests. Domain events are emitted through an `EventBus` callback;
 * the caller wires this into the platform's existing event/queue
 * infrastructure (see `src/lib/events`).
 */
import type {
  ID,
  Task,
  TaskStatus,
  TaskAssigneeChangedEvent,
  TaskCreatedEvent,
  TaskStatusChangedEvent,
  WorksuiteEvent,
} from './types';

export type EventBus = (event: WorksuiteEvent) => void | Promise<void>;

export interface TaskStore {
  get(id: ID): Promise<Task | null>;
  insert(task: Task): Promise<Task>;
  update(id: ID, patch: Partial<Task>): Promise<Task | null>;
  remove(id: ID): Promise<boolean>;
  list(filter: { projectId?: ID; status?: TaskStatus }): Promise<Task[]>;
}

/** Allowed forward transitions. Reopening (any → todo) is also allowed. */
const ALLOWED: Record<TaskStatus, TaskStatus[]> = {
  todo: ['in_progress', 'blocked', 'cancelled'],
  in_progress: ['in_review', 'blocked', 'done', 'todo', 'cancelled'],
  in_review: ['done', 'in_progress', 'blocked', 'cancelled'],
  blocked: ['todo', 'in_progress', 'cancelled'],
  done: ['todo', 'in_progress'], // reopen
  cancelled: ['todo'],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export interface CreateTaskInput {
  userId: ID;
  projectId: ID;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Task['priority'];
  assigneeIds?: ID[];
  reporterId?: ID;
  sprintId?: ID;
  parentTaskId?: ID;
  milestoneId?: ID;
  startDate?: string;
  dueDate?: string;
  estimateHours?: number;
  storyPoints?: number;
  labels?: string[];
  columnId?: ID;
  order?: number;
}

const newId = (): ID =>
  // RFC4122-ish; sufficient for non-crypto identity.
  // eslint-disable-next-line no-bitwise
  'tsk_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export async function createTask(
  store: TaskStore,
  input: CreateTaskInput,
  emit?: EventBus,
): Promise<Task> {
  const now = new Date().toISOString();
  const task: Task = {
    id: newId(),
    userId: input.userId,
    projectId: input.projectId,
    sprintId: input.sprintId,
    parentTaskId: input.parentTaskId,
    milestoneId: input.milestoneId,
    title: input.title,
    description: input.description,
    status: input.status ?? 'todo',
    priority: input.priority ?? 'medium',
    assigneeIds: [...(input.assigneeIds ?? [])],
    reporterId: input.reporterId,
    startDate: input.startDate,
    dueDate: input.dueDate,
    estimateHours: input.estimateHours,
    storyPoints: input.storyPoints,
    labels: input.labels,
    columnId: input.columnId,
    order: input.order,
    createdAt: now,
    updatedAt: now,
  };
  const saved = await store.insert(task);
  const evt: TaskCreatedEvent = { type: 'task.created', task: saved, at: now };
  await emit?.(evt);
  return saved;
}

export async function getTask(store: TaskStore, id: ID): Promise<Task | null> {
  return store.get(id);
}

export async function updateTask(
  store: TaskStore,
  id: ID,
  patch: Partial<Omit<Task, 'id' | 'userId' | 'createdAt'>>,
): Promise<Task | null> {
  return store.update(id, { ...patch, updatedAt: new Date().toISOString() });
}

export async function deleteTask(store: TaskStore, id: ID): Promise<boolean> {
  return store.remove(id);
}

export class TaskTransitionError extends Error {
  constructor(public from: TaskStatus, public to: TaskStatus) {
    super(`Illegal task transition: ${from} → ${to}`);
    this.name = 'TaskTransitionError';
  }
}

export async function changeStatus(
  store: TaskStore,
  id: ID,
  to: TaskStatus,
  by?: ID,
  emit?: EventBus,
): Promise<Task> {
  const current = await store.get(id);
  if (!current) throw new Error(`Task ${id} not found`);
  if (!canTransition(current.status, to)) {
    throw new TaskTransitionError(current.status, to);
  }
  const now = new Date().toISOString();
  const patch: Partial<Task> = { status: to, updatedAt: now };
  if (to === 'done') patch.completedAt = now;
  if (to !== 'done' && current.completedAt) patch.completedAt = undefined;
  const updated = await store.update(id, patch);
  if (!updated) throw new Error(`Task ${id} update failed`);
  const evt: TaskStatusChangedEvent = {
    type: 'task.status_changed',
    taskId: id,
    projectId: current.projectId,
    from: current.status,
    to,
    at: now,
    by,
  };
  await emit?.(evt);
  return updated;
}

export async function changeAssignees(
  store: TaskStore,
  id: ID,
  next: ID[],
  by?: ID,
  emit?: EventBus,
): Promise<Task> {
  const current = await store.get(id);
  if (!current) throw new Error(`Task ${id} not found`);
  const prev = new Set(current.assigneeIds);
  const nextSet = new Set(next);
  const added = next.filter((u) => !prev.has(u));
  const removed = current.assigneeIds.filter((u) => !nextSet.has(u));
  if (added.length === 0 && removed.length === 0) return current;
  const now = new Date().toISOString();
  const updated = await store.update(id, {
    assigneeIds: [...nextSet],
    updatedAt: now,
  });
  if (!updated) throw new Error(`Task ${id} update failed`);
  const evt: TaskAssigneeChangedEvent = {
    type: 'task.assignee_changed',
    taskId: id,
    projectId: current.projectId,
    added,
    removed,
    at: now,
    by,
  };
  await emit?.(evt);
  return updated;
}

/** In-memory store — useful for tests. */
export function createInMemoryTaskStore(): TaskStore {
  const m = new Map<ID, Task>();
  return {
    async get(id) {
      return m.get(id) ?? null;
    },
    async insert(t) {
      m.set(t.id, t);
      return t;
    },
    async update(id, patch) {
      const cur = m.get(id);
      if (!cur) return null;
      const merged = { ...cur, ...patch } as Task;
      m.set(id, merged);
      return merged;
    },
    async remove(id) {
      return m.delete(id);
    },
    async list(filter) {
      return [...m.values()].filter(
        (t) =>
          (!filter.projectId || t.projectId === filter.projectId) &&
          (!filter.status || t.status === filter.status),
      );
    },
  };
}
