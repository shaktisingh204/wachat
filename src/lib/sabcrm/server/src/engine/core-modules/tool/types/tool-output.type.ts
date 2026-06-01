import { type RecordReference } from '@/lib/sabcrm/server/src/engine/core-modules/tool/types/record-reference.type';

export type ToolOutput<T = object> = {
  success: boolean;
  message: string;
  error?: string;
  result?: T;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  recordReferences?: RecordReference[];
};
