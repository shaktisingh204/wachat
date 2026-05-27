/**
 * Types extracted from reports.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface OverdueTaskDetailRow {
  _id: string;
  title: string;
  projectName: string;
  assignedTo: string;
  dueDate: string | null;
  daysOverdue: number;
  priority: string;
  status: string;
}

export interface OverdueTasksDeepResult {
  kpis: {
    total: number;
    overdueToday: number;
    overdueThisWeek: number;
    avgOverdueDays: number;
  };
  byAssignee: Array<{ assignee: string; count: number }>;
  rows: OverdueTaskDetailRow[];
}

export interface TaskDetailRow {
  _id: string;
  title: string;
  projectName: string;
  assignedTo: string;
  status: string;
  priority: string;
  createdAt: string;
  dueDate: string | null;
  completedAt: string | null;
}

export interface TaskReportDeepResult {
  kpis: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
    completionRatePct: number;
  };
  weeklyCompleted: Array<{ week: string; count: number }>;
  rows: TaskDetailRow[];
}
