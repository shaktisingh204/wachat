export type SessionState = {
  flowId: string;
  currentGroupId: string;
  currentBlockIndex: number;
  variables: Record<string, string>;
  history: ExecutionStep[];
};

export type ExecutionStep = {
  groupId: string;
  blockId: string;
  blockType: string;
  input?: string;
  output?: string;
  timestamp: Date;
  /** When the block started executing (Step 22 trace capture). */
  startedAt?: Date;
  /** Total wall-clock time the block took to complete, in ms. */
  durationMs?: number;
  /** Per-step status — drives the replay timeline icons. */
  status?: 'success' | 'error' | 'skipped' | 'waiting';
  /** Error message when the block threw. */
  error?: string;
};

export type ExecutionResult = {
  messages: OutgoingMessage[];
  nextInputRequest?: InputRequest;
  isCompleted: boolean;
  updatedVariables: Record<string, string>;
};

export type OutgoingMessage = {
  type: 'text' | 'image' | 'video' | 'audio' | 'embed';
  content: string;
};

export type InputRequest = {
  type: string;
  blockId: string;
  groupId: string;
  options?: Record<string, unknown>;
};
