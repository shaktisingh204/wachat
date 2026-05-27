/**
 * Types extracted from public-gantt.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type PublicGanttTask = {
  _id: string;
  heading: string;
  description: string | null;
  status: string;
  priority: string | null;
  assigneeName: string | null;
  startDate: string | null;
  dueDate: string | null;
  milestoneId: string | null;
  completionPercent: number;
};

export type PublicGanttMilestone = {
  _id: string;
  title: string;
  status: string;
  endDate: string | null;
  cost: number | null;
  currency: string | null;
};
