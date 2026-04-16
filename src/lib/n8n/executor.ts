/**
 * Workflow executor — the main entry-point for running an N8NWorkflow.
 *
 * Flow:
 *  1. Build the execution graph from nodes + connections.
 *  2. Topologically sort nodes.
 *  3. Find trigger nodes and seed them with triggerData.
 *  4. Execute each node in order, passing accumulated outputs forward.
 *  5. Return a WorkflowExecution record.
 */

import { randomUUID } from 'crypto';

import type {
  N8NWorkflow,
  N8NNode,
  WorkflowExecution,
  NodeExecution,
  ExecutionContext,
  NodeExecutorResult,
} from './types';

import { buildExecutionGraph, findTriggerNodes } from './helpers/buildExecutionGraph';
import { topologicalSort } from './helpers/topologicalSort';

import { executeWebhook } from './nodeExecutors/webhookExecutor';
import { executeHttpRequest } from './nodeExecutors/httpRequestExecutor';
import { executeSetData } from './nodeExecutors/setDataExecutor';
import { executeIf } from './nodeExecutors/ifExecutor';
import { executeSwitch } from './nodeExecutors/switchExecutor';
import { executeCode } from './nodeExecutors/codeExecutor';
import { executeWhatsApp } from './nodeExecutors/whatsappExecutor';

/* ── Trigger node type predicates ───────────────────────── */
const TRIGGER_TYPES = new Set([
  'n8n-nodes-base.webhook',
  'n8n-nodes-base.start',
  'n8n-nodes-base.manualTrigger',
  'n8n-nodes-base.cron',
  'n8n-nodes-base.intervalTrigger',
  'n8n-nodes-base.emailReadImap',
]);

/* ── Node executor registry ─────────────────────────────── */
type ExecutorFn = (
  node: N8NNode,
  inputItems: Record<string, unknown>[],
  context: ExecutionContext
) => Promise<NodeExecutorResult>;

const EXECUTOR_REGISTRY: Record<string, ExecutorFn> = {
  'n8n-nodes-base.webhook': executeWebhook,
  'n8n-nodes-base.start': executeWebhook,          // start node behaves like webhook
  'n8n-nodes-base.manualTrigger': executeWebhook,
  'n8n-nodes-base.httpRequest': executeHttpRequest,
  'n8n-nodes-base.set': executeSetData,
  'n8n-nodes-base.if': executeIf,
  'n8n-nodes-base.switch': executeSwitch,
  'n8n-nodes-base.code': executeCode,
  'n8n-nodes-base.whatsapp': executeWhatsApp,
};

/** Fallback: pass items through unchanged (NoOp, sticky notes, etc.) */
async function executePassthrough(
  _node: N8NNode,
  inputItems: Record<string, unknown>[]
): Promise<NodeExecutorResult> {
  return { items: inputItems.length > 0 ? inputItems : [{}] };
}

/* ── Helpers ─────────────────────────────────────────────── */
function resolveExecutor(nodeType: string): ExecutorFn {
  return EXECUTOR_REGISTRY[nodeType] ?? executePassthrough;
}

function makeNodeExecution(node: N8NNode): NodeExecution {
  return {
    nodeId: node.id,
    nodeType: node.type,
    status: 'pending',
    inputData: [],
    outputData: [],
  };
}

/* ── Main executor ───────────────────────────────────────── */
export async function executeWorkflow(
  workflow: N8NWorkflow,
  triggerData: Record<string, unknown>,
  context?: Partial<ExecutionContext>
): Promise<WorkflowExecution> {
  const executionId = context?.executionId ?? randomUUID();
  const startedAt = new Date();

  const execContext: ExecutionContext = {
    workflowId: workflow.id,
    executionId,
    variables: { ...(context?.variables ?? {}) },
    nodeOutputs: { ...(context?.nodeOutputs ?? {}) },
  };

  const nodeExecutions: NodeExecution[] = workflow.nodes.map(makeNodeExecution);
  const nodeExecMap = new Map<string, NodeExecution>(
    nodeExecutions.map((ne) => [ne.nodeId, ne])
  );
  // Also index by node name for graph traversal
  const nodeExecByName = new Map<string, NodeExecution>(
    workflow.nodes.map((n) => [n.name, nodeExecMap.get(n.id)!])
  );

  // Build execution graph
  const graph = buildExecutionGraph(workflow);
  const { order, valid, cycleNodes } = topologicalSort(graph);

  if (!valid) {
    return {
      id: executionId,
      workflowId: workflow.id,
      status: 'error',
      startedAt,
      finishedAt: new Date(),
      nodeExecutions: nodeExecutions.map((ne) => ({
        ...ne,
        status: 'skipped' as const,
        error: `Execution aborted: circular dependency detected in nodes [${cycleNodes.join(', ')}]`,
      })),
    };
  }

  const triggerNodes = findTriggerNodes(graph);
  const triggerNodeNames = new Set(triggerNodes.map((n) => n.name));

  // itemsForNode tracks what each node will receive
  const itemsForNode = new Map<string, Record<string, unknown>[]>();

  // Seed trigger nodes with triggerData
  for (const triggerNode of triggerNodes) {
    // triggerData can be a body-wrapped object or raw items array
    const seed: Record<string, unknown>[] = Array.isArray(triggerData)
      ? (triggerData as Record<string, unknown>[])
      : [triggerData];
    itemsForNode.set(triggerNode.name, seed);
  }

  let executionStatus: WorkflowExecution['status'] = 'success';

  for (const nodeName of order) {
    const graphEntry = graph.get(nodeName);
    if (!graphEntry) continue;

    const { node } = graphEntry;
    const ne = nodeExecByName.get(nodeName);
    if (!ne) continue;

    // Skip disabled nodes — pass input straight to successors
    if (node.disabled) {
      ne.status = 'skipped';
      const inputItems = itemsForNode.get(nodeName) ?? [];
      // Forward inputs to successors on output 0
      for (const [, targets] of graphEntry.outgoing) {
        for (const target of targets) {
          const existing = itemsForNode.get(target) ?? [];
          itemsForNode.set(target, [...existing, ...inputItems]);
        }
      }
      continue;
    }

    const inputItems: Record<string, unknown>[] = triggerNodeNames.has(nodeName)
      ? (itemsForNode.get(nodeName) ?? [triggerData])
      : (itemsForNode.get(nodeName) ?? []);

    ne.status = 'running';
    ne.startedAt = new Date();
    ne.inputData = inputItems;

    const executor = resolveExecutor(node.type);
    let result: NodeExecutorResult;

    try {
      result = await executor(node, inputItems, execContext);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      ne.status = 'error';
      ne.error = msg;
      ne.finishedAt = new Date();
      executionStatus = 'error';
      // Abort entire execution on unhandled throw
      break;
    }

    ne.finishedAt = new Date();

    if (result.error) {
      ne.status = 'error';
      ne.error = result.error;
      executionStatus = 'error';
      break;
    }

    ne.status = 'success';
    ne.outputData = result.items;

    // Store outputs in context so downstream nodes can reference them
    execContext.nodeOutputs[nodeName] = result.items;

    // Route outputs to downstream nodes
    const outgoing = graphEntry.outgoing;

    // Output index 0 — true branch (or main output)
    const targets0 = outgoing.get(0) ?? [];
    for (const target of targets0) {
      const existing = itemsForNode.get(target) ?? [];
      itemsForNode.set(target, [...existing, ...result.items]);
    }

    // Output index 1 — false branch (IF node) / second switch output
    const targets1 = outgoing.get(1) ?? [];
    const falseItems = result.falseItems ?? [];
    for (const target of targets1) {
      const existing = itemsForNode.get(target) ?? [];
      itemsForNode.set(target, [...existing, ...falseItems]);
    }

    // Named branches (Switch node) — mapped by output index >= 2
    if (result.branches) {
      for (const [branchKey, branchItems] of Object.entries(result.branches)) {
        const outputIndex = parseInt(branchKey, 10);
        if (isNaN(outputIndex)) continue;
        const branchTargets = outgoing.get(outputIndex) ?? [];
        for (const target of branchTargets) {
          const existing = itemsForNode.get(target) ?? [];
          itemsForNode.set(target, [...existing, ...branchItems]);
        }
      }
    }
  }

  // Mark any still-pending nodes as skipped
  for (const ne of nodeExecutions) {
    if (ne.status === 'pending') ne.status = 'skipped';
  }

  return {
    id: executionId,
    workflowId: workflow.id,
    status: executionStatus,
    startedAt,
    finishedAt: new Date(),
    nodeExecutions,
  };
}
