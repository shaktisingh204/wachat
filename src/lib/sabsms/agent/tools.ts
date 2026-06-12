/**
 * SabSMS AI agent — tool surface (V2.12).
 *
 * The project's LLM gateway (`./llm.ts`, mirroring
 * `src/lib/sabcrm/ai-llm.server.ts`) is a plain text-completion ladder
 * with no native function-calling surface, so tools run on a
 * structured-prompt JSON protocol: the model answers with
 * `{"action":"tool","tool":"...","args":{...}}` or
 * `{"action":"reply","body":"..."}` and the runtime loops (bounded)
 * feeding tool results back.
 *
 * Tools:
 *   - lookupContact   — CRM contact by phone (the same canonical
 *                       `contacts` collection the sabsms contacts page
 *                       reads — see `src/app/sabsms/contacts/actions.ts`).
 *   - searchKnowledge — substring/chunk match over the workspace's
 *                       pasted knowledge base.
 *   - handoffToHuman  — unassigns + flags the conversation and stops the
 *                       agent for that thread.
 *   - createNote      — appends an internal note (isNote message doc).
 *
 * Worker-safe: relative imports only, no `server-only`, no `@/` paths.
 */

import type { AgentConversation, AgentStore } from './store';

// ─── Knowledge search (pure — unit-tested) ─────────────────────────────────

export interface KnowledgeHit {
  chunk: string;
  score: number;
}

/** Split pasted knowledge into paragraph-ish chunks (≤ 600 chars). */
export function chunkKnowledge(knowledge: string): string[] {
  const paragraphs = knowledge
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= 600) {
      chunks.push(p);
      continue;
    }
    for (let i = 0; i < p.length; i += 600) chunks.push(p.slice(i, i + 600));
  }
  return chunks;
}

/**
 * Rank chunks by overlapping query terms (case-insensitive substring
 * match per term, weighted by term length). Deliberately simple — the
 * V2.12 spec keeps the KB as pasted text; embeddings come later.
 */
export function searchKnowledge(
  knowledge: string,
  query: string,
  topK = 3,
): KnowledgeHit[] {
  const chunks = chunkKnowledge(knowledge);
  if (chunks.length === 0) return [];
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 3);
  if (terms.length === 0) return [];

  const hits: KnowledgeHit[] = [];
  for (const chunk of chunks) {
    const lower = chunk.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (lower.includes(term)) score += term.length;
    }
    if (score > 0) hits.push({ chunk, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, topK);
}

// ─── Tool registry ─────────────────────────────────────────────────────────

export interface ToolContext {
  store: AgentStore;
  conversation: AgentConversation;
  knowledge: string;
  /** Phone of the inbound sender (lookupContact default). */
  contactPhone: string;
  log: (message: string, extra?: Record<string, unknown>) => void;
}

export interface ToolRunResult {
  /** Stringified result fed back to the model + audited (truncated). */
  result: string;
  /** True when the tool terminates the agent turn (handoff). */
  terminal?: 'handoff';
}

export type AgentTool = (
  ctx: ToolContext,
  args: Record<string, unknown>,
) => Promise<ToolRunResult>;

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export const AGENT_TOOLS: Record<string, AgentTool> = {
  async lookupContact(ctx, args) {
    const phone = s(args.phone) || ctx.contactPhone;
    if (!phone) return { result: 'No phone number available.' };
    const contact = await ctx.store.findContactByPhone(
      ctx.conversation.workspaceId,
      phone,
    );
    if (!contact) return { result: `No CRM contact found for ${phone}.` };
    return {
      result: JSON.stringify({
        name: contact.name ?? null,
        email: contact.email ?? null,
        tags: contact.tags ?? [],
      }),
    };
  },

  async searchKnowledge(ctx, args) {
    const query = s(args.query);
    if (!query) return { result: 'searchKnowledge requires a "query" arg.' };
    const hits = searchKnowledge(ctx.knowledge, query);
    if (hits.length === 0) return { result: 'No knowledge-base matches.' };
    return { result: hits.map((h) => h.chunk).join('\n---\n').slice(0, 1500) };
  },

  async handoffToHuman(ctx) {
    await ctx.store.patchConversation(
      ctx.conversation.workspaceId,
      ctx.conversation.id,
      { status: 'open', assignedAgentId: null, 'aiFlags.handoff': true },
    );
    ctx.log('agent: handed off to human', {
      conversationId: ctx.conversation.id,
    });
    return { result: 'Conversation handed to a human agent.', terminal: 'handoff' };
  },

  async createNote(ctx, args) {
    const body = s(args.body).trim();
    if (!body) return { result: 'createNote requires a "body" arg.' };
    await ctx.store.insertNote(ctx.conversation, body.slice(0, 1000));
    return { result: 'Note saved.' };
  },
};

/** Tool manifest text injected into the system prompt. */
export function toolManifest(allowedTools: string[]): string {
  const docs: Record<string, string> = {
    lookupContact:
      'lookupContact {"phone"?: string} — look up the CRM contact for a phone number (defaults to the current sender).',
    searchKnowledge:
      'searchKnowledge {"query": string} — search the workspace knowledge base.',
    handoffToHuman:
      'handoffToHuman {} — transfer this conversation to a human agent. Use when the customer asks for a person or you cannot help.',
    createNote:
      'createNote {"body": string} — leave an internal note for the human team (never visible to the customer).',
  };
  return allowedTools
    .filter((t) => docs[t])
    .map((t) => `- ${docs[t]}`)
    .join('\n');
}
