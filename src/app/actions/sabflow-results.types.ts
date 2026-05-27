/**
 * Types extracted from sabflow-results.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type FlowSession = {
  _id: string;
  sessionId: string;
  flowId: string;
  variables: Record<string, string>;
  currentGroupId: string | null;
  currentBlockIndex: number;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  /** Message count derived from execution history stored inside the doc */
  messageCount?: number;
  /** Last message text captured during execution */
  lastMessage?: string;
};

export type FlowResultsStats = {
  totalSessions: number;
  completedSessions: number;
  completionRate: number;
  avgMessageCount: number;
};

export type DailyCount = {
  date: string; // "YYYY-MM-DD"
  total: number;
  completed: number;
};
