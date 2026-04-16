import type { ObjectId } from 'mongodb';

/* ── N8N Node Types ───────────────────────────────────── */
export type N8NNodeType =
  | 'n8n-nodes-base.webhook'
  | 'n8n-nodes-base.httpRequest'
  | 'n8n-nodes-base.set'
  | 'n8n-nodes-base.if'
  | 'n8n-nodes-base.switch'
  | 'n8n-nodes-base.code'
  | 'n8n-nodes-base.whatsapp'
  | 'n8n-nodes-base.start'
  | 'n8n-nodes-base.noOp'
  | (string & {});

/* ── N8N Connection ───────────────────────────────────── */
export type N8NConnectionType = 'main' | 'ai_tool' | (string & {});

export type N8NConnectionPoint = {
  /** Index of the output/input slot on the node */
  index: number;
  type: N8NConnectionType;
  /** Node name this connection points to */
  node: string;
};

/**
 * connections["NodeA"]["main"][outputIndex] = [{ node: "NodeB", type: "main", index: 0 }, ...]
 */
export type N8NConnections = Record<
  string,
  Record<string, N8NConnectionPoint[][]>
>;

/* ── N8N Node ─────────────────────────────────────────── */
export type N8NNodePosition = [number, number];

export type N8NNode = {
  id: string;
  name: string;
  type: N8NNodeType;
  typeVersion: number;
  position: N8NNodePosition;
  disabled?: boolean;
  /** Node-specific parameters / configuration */
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
  notes?: string;
};

/* ── N8N Workflow ─────────────────────────────────────── */
export type N8NWorkflow = {
  _id?: ObjectId;
  id: string;
  name: string;
  userId: string;
  /** n8n uses `active` to control trigger registration */
  active: boolean;
  nodes: N8NNode[];
  connections: N8NConnections;
  settings?: {
    executionOrder?: 'v0' | 'v1';
    timezone?: string;
    saveManualExecutions?: boolean;
    callerPolicy?: string;
    errorWorkflow?: string;
  };
  staticData?: Record<string, unknown>;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
};

/* ── Execution Types ──────────────────────────────────── */
export type WorkflowExecution = {
  id: string;
  workflowId: string;
  status: 'running' | 'success' | 'error' | 'waiting';
  startedAt: Date;
  finishedAt?: Date;
  nodeExecutions: NodeExecution[];
};

export type NodeExecution = {
  nodeId: string;
  nodeType: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  inputData: Record<string, unknown>[];
  outputData: Record<string, unknown>[];
  error?: string;
  startedAt?: Date;
  finishedAt?: Date;
};

export type ExecutionContext = {
  workflowId: string;
  executionId: string;
  variables: Record<string, unknown>;
  /** Keyed by node name, holds the last output items for each node */
  nodeOutputs: Record<string, Record<string, unknown>[]>;
};

/* ── Node executor interface ──────────────────────────── */
export type NodeExecutorFn = (
  node: N8NNode,
  inputItems: Record<string, unknown>[],
  context: ExecutionContext
) => Promise<NodeExecutorResult>;

export type NodeExecutorResult = {
  /** Items for the "true" / index-0 output branch */
  items: Record<string, unknown>[];
  /** Items for the "false" / index-1 output branch (IF / Switch) */
  falseItems?: Record<string, unknown>[];
  /** Named branch outputs keyed by branch value (Switch) */
  branches?: Record<string, Record<string, unknown>[]>;
  error?: string;
};

/* ── Execution graph node ─────────────────────────────── */
export type GraphNode = {
  node: N8NNode;
  /** Names of nodes this node receives data from */
  incomingFrom: string[];
  /** Outgoing connections: outputIndex -> list of target node names */
  outgoing: Map<number, string[]>;
};
