/**
 * Forge block: LangChain Retrieval QA chain
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/chains/ChainRetrievalQa/ChainRetrievalQa.node.ts
 *
 * Builds a RAG prompt from a context blob + question and asks the LLM to
 * answer using only the context. Retrieval happens upstream (vector-store
 * blocks) — this block is just the "stuff" combine step.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const SYSTEM = [
  'You are a careful retrieval-augmented assistant.',
  'Answer the user question using ONLY the supplied context.',
  'If the context does not contain the answer, reply with "I do not know based on the supplied context."',
  'Cite the most relevant context passages verbatim under a "Sources:" footer.',
].join(' ');

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Retrieval QA: apiKey is required');
  const question = asString(ctx.options.question);
  if (!question) throw new Error('Retrieval QA: question is required');
  const context = asString(ctx.options.context);
  if (!context) throw new Error('Retrieval QA: context is required');
  const baseUrl = (asString(ctx.options.baseUrl) || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = asString(ctx.options.model) || 'gpt-4o-mini';
  const temperature = asNumber(ctx.options.temperature) ?? 0;

  const userPrompt = `Context:\n"""\n${context}\n"""\n\nQuestion: ${question}`;

  const res = await apiRequest({
    service: 'Retrieval QA',
    method: 'POST',
    url: `${baseUrl}/chat/completions`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: {
      model,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      temperature,
    },
  });
  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };
  const answer = body?.choices?.[0]?.message?.content ?? '';
  return {
    outputs: { answer, context, question, raw: res.data },
    logs: [`Retrieval QA → ${model} (${answer.length} chars)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lc_chain_retrieval_qa',
  name: 'LangChain Retrieval QA',
  description: 'Answer a question grounded in supplied context (RAG combine step).',
  iconName: 'LuLibrary',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'run',
      label: 'Run retrieval QA',
      description: 'Combine the retrieved context with the question and ask the LLM to answer.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'baseUrl', label: 'Base URL', type: 'text', defaultValue: 'https://api.openai.com/v1' },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'gpt-4o-mini' },
        { id: 'context', label: 'Retrieved context', type: 'textarea', required: true },
        { id: 'question', label: 'Question', type: 'textarea', required: true },
        { id: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0 },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
