/**
 * Types extracted from hrm-roadmaps.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface RoadmapTask {
  id: string;
  title: string;
  description?: string;
  assigneeId?: string;
  assigneeName?: string;
  startDate?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  completedAt?: string;
}

export interface RoadmapPhase {
  id: string;
  name: string;
  tasks: RoadmapTask[];
}

export interface HrmRoadmap {
  _id: string;
  userId: string;
  createdBy: string;
  title: string;
  description?: string;
  phases: RoadmapPhase[];
  status: 'draft' | 'active' | 'completed' | 'archived';
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}
