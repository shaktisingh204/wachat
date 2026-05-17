/**
 * Recipe: Meeting transcript → AI summary + action items.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'ai-meeting-summary',
  name: 'AI: Meeting summary + tasks',
  category: 'ops',
  description:
    'Receive a meeting transcript, ask OpenAI for an executive summary and a checklist of action items, and email the host.',
  tags: ['ai', 'openai', 'meeting', 'summary', 'tasks'],
  trigger: {
    id: 't_transcript',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/ai/meeting-summary',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_host', name: 'host.email', defaultValue: '' },
    { id: 'v_transcript', name: 'transcript', defaultValue: '' },
    { id: 'v_summary', name: 'summary', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_ai',
      groupId: 'g_ai',
      type: 'open_ai',
      options: {
        model: 'gpt-4o-mini',
        task: 'ask_assistant',
        systemPrompt: 'Summarize meeting transcripts into TL;DR + bulleted action items with owners.',
        userMessage: '{{transcript}}',
        temperature: 0.3,
        maxTokens: 700,
        responseVariable: 'summary',
        messagesFormat: 'last',
      },
    },
    {
      id: 'b_email',
      groupId: 'g_email',
      type: 'send_email',
      options: {
        to: '{{host.email}}',
        subject: 'Meeting summary + action items',
        body: '{{summary}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
