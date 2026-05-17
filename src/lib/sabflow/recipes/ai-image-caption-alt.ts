/**
 * Recipe: AI generates an alt-text caption for an uploaded image URL.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'ai-image-caption-alt',
  name: 'AI: Image alt-text generator',
  category: 'marketing',
  description:
    'Submit an image URL; OpenAI returns an accessibility-friendly alt-text under 125 chars.',
  tags: ['ai', 'openai', 'accessibility', 'alt-text', 'image'],
  trigger: {
    id: 't_image_in',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/ai/alt-text',
      method: 'POST',
      authentication: 'none',
      responseMode: 'lastNode',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_url', name: 'imageUrl', defaultValue: '' },
    { id: 'v_alt', name: 'altText', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_ai',
      groupId: 'g_ai',
      type: 'open_ai',
      options: {
        model: 'gpt-4o-mini',
        task: 'ask_assistant',
        systemPrompt: 'You write descriptive alt-text under 125 characters.',
        userMessage: 'Describe this image for screen readers: {{imageUrl}}',
        temperature: 0.2,
        maxTokens: 100,
        responseVariable: 'altText',
        messagesFormat: 'last',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
