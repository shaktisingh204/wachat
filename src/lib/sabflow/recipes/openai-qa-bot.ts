/**
 * Recipe: OpenAI Q&A bot.
 *
 * A web form (or WhatsApp message) submits a question; the flow forwards
 * it to OpenAI's chat-completions endpoint and replies with the answer.
 * Variables let the operator change model + system-prompt without touching
 * the canvas.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'openai-qa-bot',
  name: 'OpenAI Q&A bot',
  category: 'support',
  description:
    'Capture a user question, send it to OpenAI with a configurable system prompt, and surface the answer back to the user.',
  tags: ['ai', 'openai', 'q&a', 'chatbot', 'gpt'],
  trigger: {
    id: 't_qa_received',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/qa/ask',
      method: 'POST',
      authentication: 'none',
      responseMode: 'lastNode',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_question', name: 'question', defaultValue: '' },
    { id: 'v_model', name: 'model', defaultValue: 'gpt-4o-mini' },
    {
      id: 'v_system',
      name: 'systemPrompt',
      defaultValue:
        'You are a helpful assistant. Answer the user concisely in one paragraph.',
    },
    { id: 'v_answer', name: 'answer', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_set_question',
      groupId: 'g_setup',
      type: 'set_variable',
      options: {
        variableName: 'question',
        value: '{{ $json.body.question }}',
      },
    },
    {
      id: 'b_openai',
      groupId: 'g_ai',
      type: 'open_ai',
      options: {
        model: '{{model}}',
        task: 'ask_assistant',
        systemPrompt: '{{systemPrompt}}',
        userMessage: '{{question}}',
        temperature: 0.4,
        maxTokens: 400,
        responseVariable: 'answer',
        messagesFormat: 'last',
      },
    },
    {
      id: 'b_reply',
      groupId: 'g_reply',
      type: 'text',
      options: {
        content: '{{answer}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
