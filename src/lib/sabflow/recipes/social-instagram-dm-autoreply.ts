/**
 * Recipe: Instagram comment → DM auto-reply via Meta Graph.
 *
 * Meta's webhook fires whenever a comment is posted on the brand's IG media.
 * If the comment matches one of our trigger keywords (e.g. "link please"),
 * we DM the commenter via Instagram Messaging, then react with a heart on
 * the original comment to confirm receipt.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'social-instagram-dm-autoreply',
  name: 'Social: Instagram comment → DM auto-reply',
  category: 'marketing',
  description:
    'When a follower comments a keyword on your IG post, send them a DM with the asset link and like the original comment.',
  tags: ['social', 'instagram', 'meta', 'dm', 'engagement'],
  trigger: {
    id: 't_ig_comment',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/meta/instagram-comment',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_comment_id', name: 'comment.id', defaultValue: '' },
    { id: 'v_comment_text', name: 'comment.text', defaultValue: '' },
    { id: 'v_user_id', name: 'comment.userId', defaultValue: '' },
    { id: 'v_ig_account', name: 'ig.accountId', defaultValue: '' },
    { id: 'v_keyword', name: 'trigger.keyword', defaultValue: 'link please' },
    { id: 'v_dm_body', name: 'dm.body', defaultValue: 'Hey! Here\'s the link as promised: https://sabnode.com/automation-guide' },
  ],
  blocks: [
    {
      id: 'b_extract_comment',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'comment.text', value: '{{ $json.body.entry[0].changes[0].value.text }}' },
    },
    {
      id: 'b_extract_user',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'comment.userId', value: '{{ $json.body.entry[0].changes[0].value.from.id }}' },
    },
    {
      id: 'b_match',
      groupId: 'g_match',
      type: 'condition',
      options: {
        logicalOperator: 'AND',
        conditionGroups: [
          {
            id: 'cg1',
            logicalOperator: 'AND',
            comparisons: [
              { id: 'c1', variableId: 'v_comment_text', operator: 'Contains', value: '{{trigger.keyword}}' },
            ],
          },
        ],
      },
    },
    {
      id: 'b_dm',
      groupId: 'g_dm',
      type: 'webhook',
      options: {
        url: 'https://graph.facebook.com/v25.0/{{ig.accountId}}/messages',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{META_PAGE_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"recipient":{"id":"{{comment.userId}}"},"message":{"text":"{{dm.body}}"},"messaging_type":"RESPONSE"}',
        },
      },
    },
    {
      id: 'b_like_comment',
      groupId: 'g_like',
      type: 'webhook',
      options: {
        url: 'https://graph.facebook.com/v25.0/{{comment.id}}',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{META_PAGE_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: { type: 'json', content: '{"hide":false}' },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
