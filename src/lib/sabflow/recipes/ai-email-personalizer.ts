/**
 * Recipe: AI rewrites a generic outreach email per recipient context.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'ai-email-personalizer',
  name: 'AI: Outreach personalizer',
  category: 'sales',
  description:
    'Given a generic template and a recipient profile JSON, ask OpenAI to personalize the email.',
  tags: ['ai', 'openai', 'email', 'outreach', 'personalization'],
  trigger: {
    id: 't_personalize',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/ai/personalize-email',
      method: 'POST',
      authentication: 'none',
      responseMode: 'lastNode',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_template', name: 'template', defaultValue: '' },
    { id: 'v_profile', name: 'profile', defaultValue: '' },
    { id: 'v_email_out', name: 'personalized', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_ai',
      groupId: 'g_ai',
      type: 'open_ai',
      options: {
        model: 'gpt-4o-mini',
        task: 'ask_assistant',
        systemPrompt: 'You personalize outreach emails using the recipient profile JSON.',
        userMessage:
          'Template:\n{{template}}\n\nProfile JSON:\n{{profile}}\n\nReturn only the personalized email body.',
        temperature: 0.5,
        maxTokens: 600,
        responseVariable: 'personalized',
        messagesFormat: 'last',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
