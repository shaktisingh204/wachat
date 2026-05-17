/**
 * Recipe: Weekly Twitter thread from latest blog post (RSS → AI → Buffer).
 *
 * Monday 9am cron pulls the newest blog post from RSS, asks GPT to turn it
 * into a 6-tweet thread, and schedules the thread on Buffer for 11am the
 * same morning when engagement is highest.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'social-twitter-thread-from-blog',
  name: 'Social: Weekly Twitter thread from blog',
  category: 'marketing',
  description:
    'Every Monday morning, turn last week\'s top blog post into a 6-tweet thread and queue it on Buffer for the 11am peak slot.',
  tags: ['social', 'twitter', 'thread', 'buffer', 'rss'],
  trigger: {
    id: 't_monday_9am',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_tick',
    options: { cronExpression: '0 9 * * 1' },
  },
  variables: [
    { id: 'v_feed', name: 'rss.url', defaultValue: 'https://blog.sabnode.com/rss.xml' },
    { id: 'v_buffer_profile', name: 'buffer.profileId', defaultValue: '' },
    { id: 'v_thread', name: 'thread.tweets', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_fetch',
      groupId: 'g_fetch',
      type: 'webhook',
      options: { url: '{{rss.url}}', method: 'GET', headers: [{ id: 'h1', key: 'Accept', value: 'application/rss+xml' }] },
    },
    {
      id: 'b_pick_top',
      groupId: 'g_pick',
      type: 'set_variable',
      options: { variableName: 'topPost', value: '{{ $json.items[0] }}' },
    },
    {
      id: 'b_summarize',
      groupId: 'g_ai',
      type: 'open_ai',
      options: {
        model: 'gpt-4o',
        task: 'ask_assistant',
        systemPrompt:
          'You are a senior B2B social writer. Turn a blog post into a 6-tweet thread: a strong hook in tweet 1, then 4 substantive insight tweets, then a CTA + link tweet. Each tweet <= 270 chars. Return a JSON array of strings.',
        userMessage: 'Title: {{topPost.title}}\nContent: {{topPost.content}}\nURL: {{topPost.link}}',
        temperature: 0.4,
        maxTokens: 1200,
        responseVariable: 'thread.tweets',
        messagesFormat: 'last',
      },
    },
    {
      id: 'b_loop',
      groupId: 'g_loop',
      type: 'loop',
      options: { items: '{{thread.tweets}}', itemVariable: 'tweet' },
    },
    {
      id: 'b_schedule',
      groupId: 'g_schedule',
      type: 'webhook',
      options: {
        url: 'https://api.bufferapp.com/1/updates/create.json',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{BUFFER_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/x-www-form-urlencoded' },
        ],
        body: {
          type: 'json',
          content:
            '{"text":"{{tweet}}","profile_ids":["{{buffer.profileId}}"],"scheduled_at":"{{ todayAt(\\"11:00\\") }}","thread":true}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
