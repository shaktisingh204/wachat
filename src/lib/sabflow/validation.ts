import type {
  SabFlowDoc,
  Block,
  Group,
  Edge,
  Variable,
  SabFlowEvent,
  WebhookOptions,
  ConditionOptions,
  ConditionGroup,
  TextBubbleOptions,
} from './types';

/* ── Validation error shape ──────────────────────────────────────────────── */

export type ValidationErrorType =
  | 'missing_connection'
  | 'empty_block'
  | 'invalid_config'
  | 'orphan_group'
  | 'circular_reference'
  | 'missing_variable';

export type ValidationSeverity = 'error' | 'warning';

export type ValidationError = {
  /** Unique error id (deterministic: based on location + type). */
  id: string;
  severity: ValidationSeverity;
  message: string;
  blockId?: string;
  groupId?: string;
  type: ValidationErrorType;
};

/* ── Internal helpers ────────────────────────────────────────────────────── */

/**
 * Build a set of group IDs that have at least one incoming edge.
 * An "incoming edge" is any edge whose `to.groupId` is the group's id.
 */
function buildGroupsWithIncomingEdges(edges: Edge[]): Set<string> {
  const result = new Set<string>();
  for (const edge of edges) {
    if (edge.to.groupId) result.add(edge.to.groupId);
  }
  return result;
}

/**
 * Build a set of group IDs that have at least one outgoing edge.
 * A group has an outgoing edge when any edge's `from.groupId` equals the
 * group's id, OR when any of its blocks has an `outgoingEdgeId`, OR when
 * any of its block items has an `outgoingEdgeId`.
 */
function buildGroupsWithOutgoingEdges(groups: Group[], edges: Edge[]): Set<string> {
  const result = new Set<string>();

  // From explicit edges
  for (const edge of edges) {
    if (edge.from.groupId) result.add(edge.from.groupId);
  }

  // From block-level outgoingEdgeId (inline edges not yet materialised as Edge docs)
  for (const group of groups) {
    for (const block of group.blocks) {
      if (block.outgoingEdgeId) result.add(group.id);
      if (block.items) {
        for (const item of block.items) {
          if (item.outgoingEdgeId) result.add(group.id);
        }
      }
    }
  }

  return result;
}

/**
 * Collect all variable IDs referenced inside `{{...}}` tokens in a string.
 * Maps name → id using the variables array.
 */
function extractVariableNames(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g) ?? [];
  return matches.map((m) => m.slice(2, -2).trim());
}

/**
 * Detect cycles in a directed graph using DFS (iterative).
 * Returns an array of node IDs that are part of a cycle.
 */
function detectCycles(adjacency: Map<string, string[]>): string[] {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycleNodes: string[] = [];

  function dfs(node: string): boolean {
    visited.add(node);
    inStack.add(node);

    const neighbours = adjacency.get(node) ?? [];
    for (const neighbour of neighbours) {
      if (!visited.has(neighbour)) {
        if (dfs(neighbour)) {
          cycleNodes.push(node);
          return true;
        }
      } else if (inStack.has(neighbour)) {
        cycleNodes.push(node);
        return true;
      }
    }

    inStack.delete(node);
    return false;
  }

  for (const node of Array.from(adjacency.keys())) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycleNodes;
}

/* ── Individual check functions ──────────────────────────────────────────── */

/**
 * Check: `missing_connection`
 *
 * Blocks/events that have no outgoing edge. This is a warning for most block
 * types, but an error for blocks that absolutely require a next step (none by
 * convention in this flow schema — all are warnings so the user is informed
 * without being blocked).
 *
 * Logic blocks like `redirect`, `jump`, `ab_test`, `condition` have item-level
 * edges, so we check those specifically.
 */
function checkMissingConnections(
  groups: Group[],
  edges: Edge[],
  events: SabFlowEvent[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Build a set of all source node keys that are wired in the edges list
  const wiredSources = new Set<string>();
  for (const edge of edges) {
    if (edge.from.eventId) {
      wiredSources.add(`event:${edge.from.eventId}`);
    } else if (edge.from.blockId && edge.from.itemId) {
      wiredSources.add(`item:${edge.from.blockId}:${edge.from.itemId}`);
    } else if (edge.from.blockId) {
      wiredSources.add(`block:${edge.from.blockId}`);
    } else if (edge.from.groupId) {
      wiredSources.add(`group:${edge.from.groupId}`);
    }
  }

  // Also respect inline outgoingEdgeId fields
  const hasInlineEdge = (outgoingEdgeId?: string): boolean =>
    outgoingEdgeId !== undefined && outgoingEdgeId !== '';

  // Events
  for (const event of events) {
    const isWired =
      hasInlineEdge(event.outgoingEdgeId) ||
      wiredSources.has(`event:${event.id}`);

    if (!isWired) {
      errors.push({
        id: `missing_connection:event:${event.id}`,
        severity: 'warning',
        message: 'Start event has no outgoing connection.',
        type: 'missing_connection',
      });
    }
  }

  // Blocks
  for (const group of groups) {
    for (const block of group.blocks) {
      // Blocks that route via items: condition, ab_test, choice_input,
      // picture_choice_input — skip block-level check, items are checked below.
      const isItemRouted = [
        'condition',
        'ab_test',
        'choice_input',
        'picture_choice_input',
      ].includes(block.type);

      if (!isItemRouted) {
        const isWired =
          hasInlineEdge(block.outgoingEdgeId) ||
          wiredSources.has(`block:${block.id}`);

        if (!isWired) {
          errors.push({
            id: `missing_connection:block:${block.id}`,
            severity: 'warning',
            message: `Block "${block.type}" has no outgoing connection.`,
            blockId: block.id,
            groupId: group.id,
            type: 'missing_connection',
          });
        }
      } else {
        // Check each item for an edge
        if (block.items && block.items.length > 0) {
          for (const item of block.items) {
            const isItemWired =
              hasInlineEdge(item.outgoingEdgeId) ||
              wiredSources.has(`item:${block.id}:${item.id}`);

            if (!isItemWired) {
              errors.push({
                id: `missing_connection:item:${item.id}`,
                severity: 'warning',
                message: `Choice/branch item in "${block.type}" block has no outgoing connection.`,
                blockId: block.id,
                groupId: group.id,
                type: 'missing_connection',
              });
            }
          }
        } else {
          // The block has no items at all — still no connection
          errors.push({
            id: `missing_connection:block:${block.id}:noitems`,
            severity: 'warning',
            message: `Block "${block.type}" has no items and no outgoing connection.`,
            blockId: block.id,
            groupId: group.id,
            type: 'missing_connection',
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Check: `orphan_group`
 *
 * A group is "orphaned" when it has neither incoming nor outgoing edges.
 * The start group is excluded (it will have no incoming edge by design
 * unless another group jumps to it — we only flag truly isolated groups
 * that have no connections at all).
 */
function checkOrphanGroups(
  groups: Group[],
  edges: Edge[],
  events: SabFlowEvent[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  const groupsWithIncoming = buildGroupsWithIncomingEdges(edges);
  const groupsWithOutgoing = buildGroupsWithOutgoingEdges(groups, edges);

  // The start event points to a group — find which one(s) are start targets
  const startTargets = new Set<string>();
  for (const event of events) {
    if (event.outgoingEdgeId) {
      const edge = edges.find((e) => e.id === event.outgoingEdgeId);
      if (edge) startTargets.add(edge.to.groupId);
    }
    // Wired via edge.from.eventId
    for (const edge of edges) {
      if (edge.from.eventId === event.id) startTargets.add(edge.to.groupId);
    }
  }

  for (const group of groups) {
    const hasIncoming = groupsWithIncoming.has(group.id) || startTargets.has(group.id);
    const hasOutgoing = groupsWithOutgoing.has(group.id);

    if (!hasIncoming && !hasOutgoing) {
      errors.push({
        id: `orphan_group:${group.id}`,
        severity: 'warning',
        message: `Group "${group.title}" is not connected to the rest of the flow.`,
        groupId: group.id,
        type: 'orphan_group',
      });
    }
  }

  return errors;
}

/**
 * Check: `empty_block`
 *
 * - Text bubble with no content (or only whitespace).
 * - Input blocks with no `variableId` set (they won't save the user's answer).
 */
function checkEmptyBlocks(groups: Group[]): ValidationError[] {
  const errors: ValidationError[] = [];

  const inputBlockTypes = new Set([
    'text_input',
    'number_input',
    'email_input',
    'phone_input',
    'url_input',
    'date_input',
    'time_input',
    'rating_input',
    'file_input',
    'payment_input',
    'choice_input',
    'picture_choice_input',
  ]);

  for (const group of groups) {
    for (const block of group.blocks) {
      if (block.type === 'text') {
        const opts = block.options as TextBubbleOptions | undefined;
        const hasContent =
          (opts?.content && opts.content.trim().length > 0) ||
          (opts?.richText && opts.richText.length > 0) ||
          (opts?.html && opts.html.trim().length > 0);

        if (!hasContent) {
          errors.push({
            id: `empty_block:${block.id}`,
            severity: 'warning',
            message: 'Text bubble has no content.',
            blockId: block.id,
            groupId: group.id,
            type: 'empty_block',
          });
        }
      } else if (inputBlockTypes.has(block.type)) {
        const variableId = (block.options as { variableId?: string } | undefined)?.variableId;
        if (!variableId || variableId.trim() === '') {
          errors.push({
            id: `empty_block:${block.id}:no_variable`,
            severity: 'warning',
            message: `Input block "${block.type}" has no variable assigned — the answer won't be saved.`,
            blockId: block.id,
            groupId: group.id,
            type: 'empty_block',
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Check: `missing_variable`
 *
 * Any block whose `options.variableId` (or other variable reference fields)
 * points to an ID not present in `flow.variables`.
 *
 * Also scans text content for `{{varName}}` tokens and checks the name exists.
 */
function checkMissingVariables(
  groups: Group[],
  variables: Variable[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  const variableIds = new Set(variables.map((v) => v.id));
  const variableNames = new Set(variables.map((v) => v.name));

  /** Check a variableId field (ID-based reference). */
  const checkVariableId = (
    id: string | undefined,
    block: Block,
    group: Group,
    fieldLabel: string,
  ) => {
    if (!id || id.trim() === '') return;
    if (!variableIds.has(id)) {
      errors.push({
        id: `missing_variable:${block.id}:${fieldLabel}`,
        severity: 'error',
        message: `Block "${block.type}" references a variable (${fieldLabel}) that no longer exists.`,
        blockId: block.id,
        groupId: group.id,
        type: 'missing_variable',
      });
    }
  };

  /** Check a text string for {{varName}} tokens. */
  const checkVariableTokens = (
    text: string | undefined,
    block: Block,
    group: Group,
    fieldLabel: string,
  ) => {
    if (!text) return;
    const names = extractVariableNames(text);
    for (const name of names) {
      if (!variableNames.has(name)) {
        errors.push({
          id: `missing_variable:${block.id}:token:${name}`,
          severity: 'warning',
          message: `Block "${block.type}" references undefined variable "{{${name}}}" in ${fieldLabel}.`,
          blockId: block.id,
          groupId: group.id,
          type: 'missing_variable',
        });
      }
    }
  };

  for (const group of groups) {
    for (const block of group.blocks) {
      const opts = block.options as Record<string, unknown> | undefined;
      if (!opts) continue;

      // Common variableId field
      checkVariableId(opts.variableId as string | undefined, block, group, 'variableId');

      // Webhook response mappings
      if (block.type === 'webhook') {
        const webhookOpts = opts as WebhookOptions;
        for (const mapping of webhookOpts.responseMappings ?? []) {
          checkVariableId(mapping.variableId, block, group, `responseMapping[${mapping.id}]`);
        }
        checkVariableTokens(webhookOpts.url, block, group, 'url');
        const bodyText =
          typeof webhookOpts.body === 'string'
            ? webhookOpts.body
            : webhookOpts.body?.content;
        checkVariableTokens(bodyText, block, group, 'body');
      }

      // Condition comparisons
      if (block.type === 'condition') {
        const condOpts = opts as ConditionOptions;
        for (const condGroup of condOpts.conditionGroups ?? []) {
          for (const c of (condGroup as ConditionGroup).comparisons ?? []) {
            checkVariableId(c.variableId, block, group, `conditionGroup[${condGroup.id}].comparison[${c.id}].variableId`);
          }
        }
      }

      // Text bubble content tokens
      if (block.type === 'text') {
        const textOpts = opts as TextBubbleOptions;
        checkVariableTokens(textOpts.content, block, group, 'content');
      }

      // set_variable target
      if (block.type === 'set_variable') {
        checkVariableId(opts.variableId as string | undefined, block, group, 'variableId');
        checkVariableTokens(opts.value as string | undefined, block, group, 'value');
      }
    }
  }

  return errors;
}

/**
 * Check: `circular_reference`
 *
 * Builds a group-level adjacency graph from edges and checks for cycles.
 * A cycle is reported as an error on each group involved.
 */
function checkCircularReferences(
  groups: Group[],
  edges: Edge[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Build group-id → group-id adjacency map
  const adjacency = new Map<string, string[]>();
  for (const group of groups) {
    adjacency.set(group.id, []);
  }

  for (const edge of edges) {
    const fromGroupId = edge.from.groupId;
    const toGroupId = edge.to.groupId;
    if (fromGroupId && toGroupId && fromGroupId !== toGroupId) {
      const neighbours = adjacency.get(fromGroupId);
      if (neighbours && !neighbours.includes(toGroupId)) {
        neighbours.push(toGroupId);
      }
    }
  }

  // Also add implicit jump-block targets
  for (const group of groups) {
    for (const block of group.blocks) {
      if (block.type === 'jump') {
        const targetGroupId = (block.options as { groupId?: string } | undefined)?.groupId;
        if (targetGroupId && targetGroupId !== group.id) {
          const neighbours = adjacency.get(group.id);
          if (neighbours && !neighbours.includes(targetGroupId)) {
            neighbours.push(targetGroupId);
          }
        }
      }
    }
  }

  const cycleGroupIds = detectCycles(adjacency);

  // De-duplicate: only one error per group in a cycle
  const seenCycleGroups = new Set<string>();
  for (const groupId of cycleGroupIds) {
    if (seenCycleGroups.has(groupId)) continue;
    seenCycleGroups.add(groupId);

    const group = groups.find((g) => g.id === groupId);
    errors.push({
      id: `circular_reference:${groupId}`,
      severity: 'error',
      message: `Group "${group?.title ?? groupId}" is part of a circular reference (infinite loop).`,
      groupId,
      type: 'circular_reference',
    });
  }

  return errors;
}

/**
 * Check: `invalid_config`
 *
 * - Webhook block with no URL.
 * - Condition block with no comparison items.
 */
function checkInvalidConfig(groups: Group[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const group of groups) {
    for (const block of group.blocks) {
      if (block.type === 'webhook') {
        const opts = block.options as WebhookOptions | undefined;
        if (!opts?.url || opts.url.trim() === '') {
          errors.push({
            id: `invalid_config:${block.id}:no_url`,
            severity: 'error',
            message: 'Webhook block has no URL configured.',
            blockId: block.id,
            groupId: group.id,
            type: 'invalid_config',
          });
        }
      }

      if (block.type === 'condition') {
        const opts = block.options as ConditionOptions | undefined;
        const hasComparisons =
          (opts?.conditionGroups && opts.conditionGroups.length > 0 &&
            opts.conditionGroups.some((cg) => cg.comparisons.length > 0)) ||
          // Support items-based condition structure (ConditionItem.content.comparisons)
          (block.items &&
            block.items.length > 0 &&
            block.items.some((item) => {
              const content = item.content as { comparisons?: unknown[] } | undefined;
              return (content?.comparisons?.length ?? 0) > 0;
            }));

        if (!hasComparisons) {
          errors.push({
            id: `invalid_config:${block.id}:no_conditions`,
            severity: 'error',
            message: 'Condition block has no comparison items — it will always fall through.',
            blockId: block.id,
            groupId: group.id,
            type: 'invalid_config',
          });
        }
      }
    }
  }

  return errors;
}

/* ── Main export ─────────────────────────────────────────────────────────── */

/**
 * Run all validation checks against a `SabFlowDoc` and return the combined
 * list of `ValidationError` items, sorted: errors first, then warnings.
 */
export function validateFlow(flow: SabFlowDoc): ValidationError[] {
  const all: ValidationError[] = [
    ...checkMissingConnections(flow.groups, flow.edges, flow.events),
    ...checkOrphanGroups(flow.groups, flow.edges, flow.events),
    ...checkEmptyBlocks(flow.groups),
    ...checkMissingVariables(flow.groups, flow.variables),
    ...checkCircularReferences(flow.groups, flow.edges),
    ...checkInvalidConfig(flow.groups),
  ];

  // Sort: errors before warnings, then alphabetically by id for stable order
  return all.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'error' ? -1 : 1;
    }
    return a.id.localeCompare(b.id);
  });
}

/** Convenience: count errors and warnings separately. */
export function countValidationResults(errors: ValidationError[]): {
  errorCount: number;
  warningCount: number;
  total: number;
} {
  let errorCount = 0;
  let warningCount = 0;
  for (const e of errors) {
    if (e.severity === 'error') errorCount++;
    else warningCount++;
  }
  return { errorCount, warningCount, total: errors.length };
}
