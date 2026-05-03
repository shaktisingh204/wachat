/**
 * Jira JSON importer (skeleton).
 *
 * Maps a Jira REST `search` payload (issues array) to internal Task
 * shapes. Field handling is intentionally conservative — only the
 * obvious 1:1 mappings are performed; the caller is expected to enrich
 * users, projects, etc., post-import.
 */
import type { ID, Task, TaskPriority, TaskStatus } from '../types';

export interface JiraImportInput {
  userId: ID;
  projectId: ID;
  issues: JiraIssueLike[];
}

export interface JiraIssueLike {
  id?: string;
  key: string;
  fields?: {
    summary?: string;
    description?: string | { content?: unknown };
    status?: { name?: string; statusCategory?: { key?: string } };
    priority?: { name?: string };
    assignee?: { accountId?: string; displayName?: string } | null;
    reporter?: { accountId?: string; displayName?: string } | null;
    duedate?: string | null;
    created?: string;
    updated?: string;
    labels?: string[];
    customfield_10016?: number; // story points (default Jira mapping)
    customfield_10026?: number; // alternate
  };
}

export interface JiraImportResult {
  tasks: Task[];
  /** External-key → internal-id index (for follow-up dependency mapping). */
  keyMap: Record<string, ID>;
  warnings: string[];
}

const STATUS_MAP: Record<string, TaskStatus> = {
  'to do': 'todo',
  todo: 'todo',
  open: 'todo',
  backlog: 'todo',
  'in progress': 'in_progress',
  'in review': 'in_review',
  review: 'in_review',
  blocked: 'blocked',
  done: 'done',
  closed: 'done',
  resolved: 'done',
  cancelled: 'cancelled',
  canceled: 'cancelled',
};

const PRIORITY_MAP: Record<string, TaskPriority> = {
  lowest: 'low',
  low: 'low',
  medium: 'medium',
  high: 'high',
  highest: 'urgent',
  urgent: 'urgent',
  critical: 'urgent',
};

export function importJira(input: JiraImportInput): JiraImportResult {
  const tasks: Task[] = [];
  const keyMap: Record<string, ID> = {};
  const warnings: string[] = [];
  for (const issue of input.issues) {
    if (!issue.key) {
      warnings.push('Skipped issue without key');
      continue;
    }
    const f = issue.fields ?? {};
    const status = mapStatus(f.status?.name) ?? 'todo';
    const priority = mapPriority(f.priority?.name) ?? 'medium';
    const id = newId(issue.key);
    keyMap[issue.key] = id;
    const description = typeof f.description === 'string' ? f.description : undefined;
    const now = new Date().toISOString();
    const task: Task = {
      id,
      userId: input.userId,
      projectId: input.projectId,
      title: f.summary ?? issue.key,
      description,
      status,
      priority,
      assigneeIds: f.assignee?.accountId ? [f.assignee.accountId] : [],
      reporterId: f.reporter?.accountId,
      dueDate: f.duedate ?? undefined,
      storyPoints: f.customfield_10016 ?? f.customfield_10026,
      labels: f.labels,
      createdAt: f.created ?? now,
      updatedAt: f.updated ?? now,
    };
    tasks.push(task);
  }
  return { tasks, keyMap, warnings };
}

function mapStatus(name?: string): TaskStatus | undefined {
  if (!name) return undefined;
  return STATUS_MAP[name.toLowerCase()];
}

function mapPriority(name?: string): TaskPriority | undefined {
  if (!name) return undefined;
  return PRIORITY_MAP[name.toLowerCase()];
}

function newId(key: string): ID {
  return `tsk_jira_${key.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;
}
