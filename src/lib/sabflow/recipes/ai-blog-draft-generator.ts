/**
 * Recipe: AI blog draft generator from a topic prompt.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'ai-blog-draft-generator',
  name: 'AI: Blog draft generator',
  category: 'marketing',
  description:
    'Take a topic prompt, ask OpenAI to draft a 600-word blog post in your tone of voice, and stash it.',
  tags: ['ai', 'openai', 'blog', 'content', 'marketing'],
  trigger: {
    id: 't_blog_brief',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/content/blog-brief',
      method: 'POST',
      authentication: 'none',
      responseMode: 'lastNode',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_topic', name: 'topic', defaultValue: '' },
    { id: 'v_tone', name: 'tone', defaultValue: 'friendly and authoritative' },
    { id: 'v_draft', name: 'draft', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_set',
      groupId: 'g_setup',
      type: 'set_variable',
      options: { variableName: 'topic', value: '{{ $json.body.topic }}' },
    },
    {
      id: 'b_ai',
      groupId: 'g_ai',
      type: 'open_ai',
      options: {
        model: 'gpt-4o-mini',
        task: 'ask_assistant',
        systemPrompt: 'You are a senior content writer. Write in a {{tone}} tone.',
        userMessage: 'Draft a 600-word blog post about: {{topic}}',
        temperature: 0.7,
        maxTokens: 900,
        responseVariable: 'draft',
        messagesFormat: 'last',
      },
    },
    {
      id: 'b_save',
      groupId: 'g_save',
      type: 'webhook',
      options: {
        url: '/api/content/drafts',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: { type: 'json', content: '{"topic":"{{topic}}","draft":"{{draft}}"}' },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
