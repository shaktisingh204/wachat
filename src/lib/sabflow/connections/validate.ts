import type { Block, Edge, NodePort } from '../types';
import { parsePortId, getDefaultPorts, DEFAULT_SOURCE_HANDLE, DEFAULT_TARGET_HANDLE } from '../ports';

export type ValidationResult = { valid: boolean; reason?: string };

/**
 * Check whether a proposed connection between two handles is valid.
 *
 * Rules enforced:
 * 1. Same mode (output->output or input->input) is invalid.
 * 2. Different port types (main->ai, etc.) is invalid.
 * 3. Self-connection (source block === target block) is invalid.
 * 4. Exceeding a handle's maxConnections is invalid.
 * 5. Creating a cycle produces a warning but is allowed.
 */
export function isValidConnection(params: {
  sourceHandle: string;
  targetHandle: string;
  existingEdges: Edge[];
  sourceBlock: Block;
  targetBlock: Block;
}): ValidationResult {
  const { sourceHandle, targetHandle, existingEdges, sourceBlock, targetBlock } = params;

  // 1. Self-connection
  if (sourceBlock.id === targetBlock.id) {
    return { valid: false, reason: 'Cannot connect a block to itself' };
  }

  // 2. Parse handle IDs
  const sourceParsed = parsePortId(sourceHandle);
  const targetParsed = parsePortId(targetHandle);

  if (!sourceParsed || !targetParsed) {
    return { valid: false, reason: 'Invalid handle ID format' };
  }

  // 3. Same mode check
  if (sourceParsed.mode === targetParsed.mode) {
    return {
      valid: false,
      reason: `Cannot connect ${sourceParsed.mode} to ${targetParsed.mode}`,
    };
  }

  // 4. Type compatibility
  if (sourceParsed.type !== targetParsed.type) {
    return {
      valid: false,
      reason: `Incompatible port types: ${sourceParsed.type} and ${targetParsed.type}`,
    };
  }

  // 5. Max connections check
  const sourcePort = findPort(sourceBlock, sourceHandle, 'output');
  const targetPort = findPort(targetBlock, targetHandle, 'input');

  if (sourcePort) {
    const maxOut = sourcePort.maxConnections ?? Infinity;
    const currentOut = existingEdges.filter(
      (e) =>
        e.from.blockId === sourceBlock.id &&
        (e.sourceHandle ?? DEFAULT_SOURCE_HANDLE) === sourceHandle,
    ).length;
    if (currentOut >= maxOut) {
      return { valid: false, reason: 'Source handle has reached maximum connections' };
    }
  }

  if (targetPort) {
    const maxIn = targetPort.maxConnections ?? 1;
    const currentIn = existingEdges.filter(
      (e) =>
        e.to.blockId === targetBlock.id &&
        (e.targetHandle ?? DEFAULT_TARGET_HANDLE) === targetHandle,
    ).length;
    if (currentIn >= maxIn) {
      return { valid: false, reason: 'Target handle has reached maximum connections' };
    }
  }

  // 6. Duplicate check — don't allow the same exact connection twice
  const isDuplicate = existingEdges.some(
    (e) =>
      e.from.blockId === sourceBlock.id &&
      e.to.blockId === targetBlock.id &&
      (e.sourceHandle ?? DEFAULT_SOURCE_HANDLE) === sourceHandle &&
      (e.targetHandle ?? DEFAULT_TARGET_HANDLE) === targetHandle,
  );
  if (isDuplicate) {
    return { valid: false, reason: 'Connection already exists' };
  }

  return { valid: true };
}

/** Look up a port from a block's custom ports or fall back to defaults. */
function findPort(
  block: Block,
  handleId: string,
  mode: 'input' | 'output',
): NodePort | undefined {
  const customPorts = mode === 'input' ? block.inputPorts : block.outputPorts;
  if (customPorts) {
    return customPorts.find((p) => p.id === handleId);
  }
  const defaults = getDefaultPorts(block.type);
  const ports = mode === 'input' ? defaults.inputs : defaults.outputs;
  return ports.find((p) => p.id === handleId);
}

/**
 * Detect if adding an edge from sourceBlockId to targetBlockId would create
 * a cycle in the flow graph. Returns true if a cycle would be formed.
 *
 * Uses a simple DFS traversal from the target block following existing edges
 * to see if we can reach the source block.
 */
export function wouldCreateCycle(
  sourceBlockId: string,
  targetBlockId: string,
  edges: Edge[],
): boolean {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const from = edge.from.blockId ?? edge.from.groupId;
    const to = edge.to.blockId ?? edge.to.groupId;
    if (from && to) {
      const existing = adjacency.get(from) ?? [];
      existing.push(to);
      adjacency.set(from, existing);
    }
  }

  // DFS from targetBlockId — if we reach sourceBlockId, there's a cycle
  const visited = new Set<string>();
  const stack = [targetBlockId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === sourceBlockId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const neighbors = adjacency.get(current) ?? [];
    for (const neighbor of neighbors) {
      stack.push(neighbor);
    }
  }
  return false;
}
