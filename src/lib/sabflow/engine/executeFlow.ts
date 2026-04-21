import type { SabFlowDoc } from '@/lib/sabflow/types';
import type { SessionState, ExecutionResult, InputRequest } from './types';
import type { OutgoingMessage } from './types';
import { executeBlock } from './executeBlock';

type ExecuteFlowReturn = {
  result: ExecutionResult;
  updatedSession: SessionState;
};

/**
 * Execute the flow starting from the position encoded in `session`.
 *
 * The engine walks blocks sequentially within the current group, following
 * edges to new groups until either:
 *  - An input block is encountered (paused, awaiting user reply)
 *  - The flow has no more blocks/edges to follow (completed)
 *
 * When `userInput` is provided it is consumed by the first input block that is
 * encountered (i.e. the block recorded in `session.currentBlockIndex`).
 */
export async function executeFlow(
  flow: SabFlowDoc,
  session: SessionState,
  userInput?: string,
): Promise<ExecuteFlowReturn> {
  const messages: OutgoingMessage[] = [];
  let variables = { ...session.variables };
  let currentGroupId = session.currentGroupId;
  let currentBlockIndex = session.currentBlockIndex;

  // Safety valve: cap the number of group transitions to prevent infinite
  // loops caused by misconfigured flows.
  const MAX_GROUP_HOPS = 100;
  let hopCount = 0;

  outer: while (hopCount < MAX_GROUP_HOPS) {
    const group = flow.groups.find((g) => g.id === currentGroupId);
    if (!group) break;

    for (let i = currentBlockIndex; i < group.blocks.length; i++) {
      const block = group.blocks[i];

      // Only pass userInput to the first block of the current position (the
      // one that previously requested input).
      const inputForThisBlock =
        i === session.currentBlockIndex &&
        currentGroupId === session.currentGroupId
          ? userInput
          : undefined;

      const blockResult = await executeBlock(
        block,
        variables,
        flow.edges,
        inputForThisBlock,
      );

      // Accumulate messages from this block
      messages.push(...blockResult.messages);

      // Merge variable updates
      if (blockResult.updatedVariables) {
        variables = blockResult.updatedVariables;
      }

      // The block needs user input — pause execution here
      if (blockResult.requiresInput) {
        const inputRequest: InputRequest = {
          type: block.type,
          blockId: block.id,
          groupId: currentGroupId,
          options: block.options as Record<string, unknown> | undefined,
        };

        return {
          result: {
            messages,
            nextInputRequest: inputRequest,
            isCompleted: false,
            updatedVariables: variables,
          },
          updatedSession: {
            ...session,
            currentGroupId,
            currentBlockIndex: i,
            variables,
            history: [
              ...session.history,
              {
                groupId: currentGroupId,
                blockId: block.id,
                blockType: block.type,
                timestamp: new Date(),
              },
            ],
          },
        };
      }

      // The block explicitly navigated to a new group (condition, jump, etc.)
      if (blockResult.nextGroupId) {
        currentGroupId = blockResult.nextGroupId;
        currentBlockIndex = 0;
        hopCount++;
        continue outer;
      }

      // The block failed and signalled how to proceed.
      if (blockResult.errorSignal) {
        if (blockResult.errorSignal.kind === 'goto') {
          currentGroupId = blockResult.errorSignal.groupId;
          currentBlockIndex = 0;
          hopCount++;
          continue outer;
        }
        // 'halt' — terminate execution with the error surfaced as a message.
        return {
          result: {
            messages,
            isCompleted: true,
            updatedVariables: variables,
          },
          updatedSession: {
            ...session,
            currentGroupId,
            currentBlockIndex: i,
            variables,
            history: [
              ...session.history,
              {
                groupId: currentGroupId,
                blockId: block.id,
                blockType: block.type,
                timestamp: new Date(),
                output: blockResult.errorSignal.message,
              },
            ],
          },
        };
      }

      // The block has an outgoing edge — follow it at the end of this block
      // (handled after the for-loop falls through to the edge resolution below)
    }

    // All blocks in the current group executed.  Resolve the outgoing edge of
    // the last block (if any) to determine the next group.
    const lastBlock = group.blocks.at(-1);
    if (lastBlock?.outgoingEdgeId) {
      const edge = flow.edges.find((e) => e.id === lastBlock.outgoingEdgeId);
      if (edge?.to.groupId) {
        currentGroupId = edge.to.groupId;
        currentBlockIndex = 0;
        hopCount++;
        continue;
      }
    }

    // No outgoing edge from the last block → flow is complete
    break;
  }

  return {
    result: {
      messages,
      isCompleted: true,
      updatedVariables: variables,
    },
    updatedSession: {
      ...session,
      currentGroupId,
      currentBlockIndex: 0,
      variables,
      history: [
        ...session.history,
        {
          groupId: currentGroupId,
          blockId: '__end__',
          blockType: '__end__',
          timestamp: new Date(),
        },
      ],
    },
  };
}
