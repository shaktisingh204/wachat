/**
 * Asana JSON importer (skeleton).
 *
 * Maps a list of Asana `tasks` API payloads onto internal `Task`
 * records. Subtasks are not pulled in here — the caller can run a
 * second pass keyed by `parentGid → keyMap`.
 */
import type { ID, Task, TaskPriority, TaskStatus } from '../types';

export interface AsanaImportInput {
  userId: ID;
  projectId: ID;
  tasks: AsanaTaskLike[];
}

export interface AsanaTaskLike {
  gid: string;
  name: string;
  notes?: string;
  completed?: boolean;
  completed_at?: string | null;
  due_on?: string | null;
  due_at?: string | null;
  start_on?: string | null;
  assignee?: { gid: string; name?: string } | null;
  followers?: Array<{ gid: string }>;
  custom_fields?: Array<{
    name?: string;
    enum_value?: { name?: string } | null;
    number_value?: number | null;
  }>;
  tags?: Array<{ name?: string }>;
  parent?: { gid: string } | null;
  created_at?: string;
  modified_at?: string;
}

export interface AsanaImportResult {
  tasks: Task[];
  keyMap: Record<string, ID>;
  warnings: string[];
}

const PRIORITY_FIELD_NAMES = new Set(['priority', 'priority level']);
const PRIORITY_MAP: Record<string, TaskPriority> = {
  low: 'low',
  medium: 'medium',
  normal: 'medium',
  high: 'high',
  urgent: 'urgent',
  critical: 'urgent',
};

export function importAsana(input: AsanaImportInput): AsanaImportResult {
  const tasks: Task[] = [];
  const keyMap: Record<string, ID> = {};
  const warnings: string[] = [];
  for (const t of input.tasks) {
    if (!t.gid) {
      warnings.push('Skipped task without gid');
      continue;
    }
    const id = newId(t.gid);
    keyMap[t.gid] = id;
    const status: TaskStatus = t.completed ? 'done' : 'todo';
    const priority = extractPriority(t.custom_fields) ?? 'medium';
    const labels = (t.tags ?? [])
      .map((tag) => tag.name)
      .filter((n): n is string => !!n);
    const now = new Date().toISOString();
    const task: Task = {
      id,
      userId: input.userId,
      projectId: input.projectId,
      title: t.name,
      description: t.notes,
      status,
      priority,
      assigneeIds: t.assignee?.gid ? [t.assignee.gid] : [],
      reporterId: t.followers?.[0]?.gid,
      startDate: t.start_on ?? undefined,
      dueDate: t.due_at ?? t.due_on ?? undefined,
      labels: labels.length ? labels : undefined,
      parentTaskId: t.parent?.gid,
      createdAt: t.created_at ?? now,
      updatedAt: t.modified_at ?? now,
      completedAt: t.completed_at ?? undefined,
    };
    tasks.push(task);
  }
  return { tasks, keyMap, warnings };
}

function extractPriority(
  fields: AsanaTaskLike['custom_fields'],
): TaskPriority | undefined {
  if (!fields) return undefined;
  for (const f of fields) {
    if (!f.name) continue;
    if (!PRIORITY_FIELD_NAMES.has(f.name.toLowerCase())) continue;
    const v = f.enum_value?.name?.toLowerCase();
    if (v && PRIORITY_MAP[v]) return PRIORITY_MAP[v];
  }
  return undefined;
}

function newId(gid: string): ID {
  return `tsk_asana_${gid}_${Date.now().toString(36)}`;
}
