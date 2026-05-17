/**
 * Recipe: RSS → cross-post to Twitter, LinkedIn, and Mastodon.
 *
 * Polls the company blog's RSS feed every 15 minutes. For each new entry we
 * generate a platform-tailored caption with GPT-4 and post to Twitter,
 * LinkedIn, and Mastodon in parallel groups.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'social-rss-crosspost',
  name: 'Social: RSS → Twitter + LinkedIn + Mastodon',
  category: 'marketing',
  description:
    'Watch the company RSS feed and cross-post new entries to Twitter, LinkedIn, and Mastodon with tailored captions for each platform.',
  tags: ['social', 'rss', 'twitter', 'linkedin', 'mastodon'],
  trigger: {
    id: 't_rss',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_tick',
    options: { cronExpression: '*/15 * * * *' },
  },
  variables: [
    { id: 'v_feed', name: 'rss.url', defaultValue: 'https://blog.sabnode.com/rss.xml' },
    { id: 'v_brand_voice', name: 'brand.voice', defaultValue: 'warm, specific, never hypey' },
  ],
  blocks: [
    {
      id: 'b_fetch_feed',
      groupId: 'g_fetch',
      type: 'webhook',
      options: { url: '{{rss.url}}', method: 'GET', headers: [{ id: 'h1', key: 'Accept', value: 'application/rss+xml' }] },
    },
    {
      id: 'b_loop_new',
      groupId: 'g_loop',
      type: 'loop',
      options: { items: '{{ $json.newItems }}', itemVariable: 'post' },
    },
    {
      id: 'b_caption',
      groupId: 'g_caption',
      type: 'open_ai',
      options: {
        model: 'gpt-4o-mini',
        task: 'ask_assistant',
        systemPrompt:
          'You rewrite a blog post title + summary into three captions: twitter (<=270 chars), linkedin (<=600 chars, light formatting), mastodon (<=500 chars). Brand voice: {{brand.voice}}. Return JSON.',
        userMessage: 'Title: {{post.title}}\nSummary: {{post.summary}}\nURL: {{post.link}}',
        temperature: 0.5,
        maxTokens: 400,
        responseVariable: 'captions',
        messagesFormat: 'last',
      },
    },
    {
      id: 'b_twitter',
      groupId: 'g_twitter',
      type: 'webhook',
      options: {
        url: 'https://api.twitter.com/2/tweets',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{TWITTER_BEARER}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: { type: 'json', content: '{"text":"{{ captions.twitter }}"}' },
      },
    },
    {
      id: 'b_linkedin',
      groupId: 'g_linkedin',
      type: 'webhook',
      options: {
        url: 'https://api.linkedin.com/v2/ugcPosts',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{LINKEDIN_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
          { id: 'h3', key: 'X-Restli-Protocol-Version', value: '2.0.0' },
        ],
        body: {
          type: 'json',
          content:
            '{"author":"urn:li:organization:{{LINKEDIN_ORG_ID}}","lifecycleState":"PUBLISHED","specificContent":{"com.linkedin.ugc.ShareContent":{"shareCommentary":{"text":"{{ captions.linkedin }}"},"shareMediaCategory":"NONE"}},"visibility":{"com.linkedin.ugc.MemberNetworkVisibility":"PUBLIC"}}',
        },
      },
    },
    {
      id: 'b_mastodon',
      groupId: 'g_mastodon',
      type: 'webhook',
      options: {
        url: 'https://mastodon.social/api/v1/statuses',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{MASTODON_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: { type: 'json', content: '{"status":"{{ captions.mastodon }}","visibility":"public"}' },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
