import type { Block, Edge } from '@/lib/sabflow/types';
import type { OutgoingMessage } from './types';
import type { Condition } from './evaluateCondition';
import { evaluateCondition } from './evaluateCondition';
import { substituteVariables } from './substituteVariables';

export type BlockExecutionResult = {
  messages: OutgoingMessage[];
  /**
   * Set to the ID of the group to navigate to next (edge traversal already
   * resolved by this function for condition blocks).
   */
  nextGroupId?: string;
  updatedVariables?: Record<string, string>;
  /** True when the block needs a user reply before execution can continue. */
  requiresInput?: boolean;
};

const INPUT_TYPES = new Set([
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

/**
 * Executes a single block and returns messages, variable updates, and
 * navigation hints.  The `edges` array is required for blocks that perform
 * their own edge selection (condition, redirect, etc.).
 */
export async function executeBlock(
  block: Block,
  variables: Record<string, string>,
  edges: Edge[],
  userInput?: string,
): Promise<BlockExecutionResult> {
  switch (block.type) {
    // ── Bubble blocks ────────────────────────────────────────────────────────
    case 'text': {
      const raw =
        (block.options?.content as string | undefined) ??
        (block.options?.text as string | undefined) ??
        '';
      const content = substituteVariables(raw, variables);
      return { messages: [{ type: 'text', content }] };
    }

    case 'image': {
      const url =
        (block.options?.url as string | undefined) ??
        (block.options?.imageUrl as string | undefined) ??
        '';
      return { messages: [{ type: 'image', content: substituteVariables(url, variables) }] };
    }

    case 'video': {
      const url =
        (block.options?.url as string | undefined) ??
        (block.options?.videoUrl as string | undefined) ??
        '';
      return { messages: [{ type: 'video', content: substituteVariables(url, variables) }] };
    }

    case 'audio': {
      const url =
        (block.options?.url as string | undefined) ??
        (block.options?.audioUrl as string | undefined) ??
        '';
      return { messages: [{ type: 'audio', content: substituteVariables(url, variables) }] };
    }

    case 'embed': {
      const url =
        (block.options?.url as string | undefined) ??
        (block.options?.embedUrl as string | undefined) ??
        '';
      return { messages: [{ type: 'embed', content: substituteVariables(url, variables) }] };
    }

    // ── Input blocks ─────────────────────────────────────────────────────────
    default: {
      if (INPUT_TYPES.has(block.type)) {
        // If we already have user input, store it in the target variable and
        // continue; otherwise signal that we need user input.
        if (userInput !== undefined) {
          const variableId = block.options?.variableId as string | undefined;
          const variableName = block.options?.variableName as string | undefined;
          const key = variableName ?? variableId;
          const updatedVariables = key
            ? { ...variables, [key]: userInput }
            : variables;
          return { messages: [], updatedVariables };
        }
        return { messages: [], requiresInput: true };
      }
      return { messages: [] };
    }

    // ── Logic blocks ─────────────────────────────────────────────────────────
    case 'condition': {
      // items array holds condition branches, each with an outgoingEdgeId
      const items = (block.items ?? []) as Array<{
        id: string;
        content?: Condition;
        outgoingEdgeId?: string;
      }>;

      const passedItem = items.find(
        (item) =>
          item.content &&
          evaluateCondition(item.content, variables),
      );

      const winningEdgeId = passedItem?.outgoingEdgeId ?? block.outgoingEdgeId;
      const nextEdge = edges.find((e) => e.id === winningEdgeId);
      return { messages: [], nextGroupId: nextEdge?.to.groupId };
    }

    case 'set_variable': {
      const variableId = block.options?.variableId as string | undefined;
      const variableName = block.options?.variableName as string | undefined;
      const key = variableName ?? variableId;
      if (!key) return { messages: [] };

      const expression = (block.options?.expressionToEvaluate as string | undefined) ?? '';
      const value = substituteVariables(expression, variables);
      return {
        messages: [],
        updatedVariables: { ...variables, [key]: value },
      };
    }

    case 'redirect': {
      const url = substituteVariables(
        (block.options?.url as string | undefined) ?? '',
        variables,
      );
      // Emit a text message carrying the redirect URL so the client can act on it
      return {
        messages: [{ type: 'text', content: `REDIRECT:${url}` }],
      };
    }

    case 'script': {
      const code = substituteVariables(
        (block.options?.content as string | undefined) ?? '',
        variables,
      );
      let result = '';
      try {
        // Very lightweight sandbox: the script gets a read-only variables
        // object and can return a string value via `return`.
        const fn = new Function('variables', `"use strict"; ${code}`);
        const raw = fn({ ...variables });
        if (raw !== undefined && raw !== null) result = String(raw);
      } catch (err) {
        result = `Script error: ${err instanceof Error ? err.message : String(err)}`;
      }
      const saveVariableId =
        (block.options?.variableId as string | undefined) ??
        (block.options?.variableName as string | undefined);
      const updatedVariables =
        saveVariableId && result
          ? { ...variables, [saveVariableId]: result }
          : undefined;
      return { messages: [], updatedVariables };
    }

    case 'wait': {
      // The engine records the wait but does not actually sleep.  Callers
      // that need a real delay should read `options.waitFor` (ms).
      return { messages: [] };
    }

    case 'jump': {
      // Jump carries a groupId in options; surface it as nextGroupId directly.
      const targetGroupId = block.options?.groupId as string | undefined;
      return { messages: [], nextGroupId: targetGroupId };
    }

    case 'typebot_link': {
      // Out-of-scope for the current engine; treat as a no-op.
      return { messages: [] };
    }

    case 'ab_test': {
      // Randomly pick one of the two paths (50/50).
      const edgeA = block.items?.[0]?.outgoingEdgeId as string | undefined;
      const edgeB = block.items?.[1]?.outgoingEdgeId as string | undefined;
      const chosenEdgeId = Math.random() < 0.5 ? edgeA : (edgeB ?? edgeA);
      const nextEdge = edges.find((e) => e.id === chosenEdgeId);
      return { messages: [], nextGroupId: nextEdge?.to.groupId };
    }

    // ── Integration blocks ────────────────────────────────────────────────────
    case 'webhook': {
      const url = substituteVariables(
        (block.options?.url as string | undefined) ?? '',
        variables,
      );
      const method =
        ((block.options?.method as string | undefined) ?? 'GET').toUpperCase();
      const headers = (block.options?.headers as Record<string, string> | undefined) ?? {};
      const bodyTemplate = block.options?.body as string | undefined;

      if (!url) return { messages: [] };

      let responseText = '';
      try {
        const fetchOptions: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(
              Object.entries(headers).map(([k, v]) => [
                k,
                substituteVariables(v, variables),
              ]),
            ),
          },
        };
        if (bodyTemplate && method !== 'GET') {
          fetchOptions.body = substituteVariables(bodyTemplate, variables);
        }
        const res = await fetch(url, fetchOptions);
        responseText = await res.text();
      } catch (err) {
        responseText = `Webhook error: ${err instanceof Error ? err.message : String(err)}`;
      }

      // Optionally save the response body into a variable
      const responseVariableId =
        (block.options?.responseVariableId as string | undefined) ??
        (block.options?.saveResponseVariableId as string | undefined);
      const updatedVariables =
        responseVariableId
          ? { ...variables, [responseVariableId]: responseText }
          : undefined;

      return { messages: [], updatedVariables };
    }

    case 'send_email':
    case 'google_sheets':
    case 'google_analytics':
    case 'open_ai':
    case 'zapier':
    case 'make_com':
    case 'pabbly_connect':
    case 'chatwoot':
    case 'pixel':
    case 'segment':
    case 'cal_com':
    case 'nocodb':
    case 'elevenlabs':
    case 'anthropic':
    case 'together_ai':
    case 'mistral': {
      // Third-party integration blocks are not executed server-side in this
      // engine.  They are treated as no-ops; a dedicated worker/action should
      // handle them externally.
      return { messages: [] };
    }
  }
}
