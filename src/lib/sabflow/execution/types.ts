export type FlowSession = {
  id: string;
  flowId: string;
  userId?: string;
  variables: Record<string, string | undefined>;
  currentGroupId?: string;
  currentBlockIndex?: number;
  status: 'active' | 'completed' | 'abandoned';
  startedAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
};

export type ChatMessage = {
  id: string;
  role: 'host' | 'guest';
  content: string;
  timestamp: Date;
  blockId?: string;
};

export type ExecutionStep = {
  type:
    | 'message'
    | 'input'
    | 'redirect'
    | 'condition_evaluated'
    | 'variable_set'
    | 'script_executed';
  payload: Record<string, unknown>;
};
