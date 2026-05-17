/**
 * Recipe: AI rewrite a long-form post into 5 short social tweets.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'ai-social-rewriter',
  name: 'AI: Long post → social tweets',
  category: 'marketing',
  description:
    'Submit a long-form post; OpenAI returns a numbered list of five tweet-sized rewrites.',
  tags: ['ai', 'openai', 'social', 'twitter', 'marketing'],
  trigger: {
    id: 't_post_in',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/content/social-rewrite',
      method: 'POST',
      authentication: 'none',
      responseMode: 'lastNode',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_post', name: 'post', defaultValue: '' },
    { id: 'v_tweets', name: 'tweets', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_set',
      groupId: 'g_setup',
      type: 'set_variable',
      options: { variableName: 'post', value: '{{ $json.body.post }}' },
    },
    {
      id: 'b_ai',
      groupId: 'g_ai',
      type: 'open_ai',
      options: {
        model: 'gpt-4o-mini',
        task: 'ask_assistant',
        systemPrompt: 'You compress long-form into punchy social posts.',
        userMessage: 'Rewrite this post as 5 tweet-sized hooks (1–280 chars each):\n\n{{post}}',
        temperature: 0.6,
        maxTokens: 500,
        responseVariable: 'tweets',
        messagesFormat: 'last',
      },
    },
    {
      id: 'b_reply',
      groupId: 'g_reply',
      type: 'text',
      options: { content: '{{tweets}}' },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
