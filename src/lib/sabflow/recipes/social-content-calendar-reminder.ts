/**
 * Recipe: Daily content-calendar reminder + Notion update.
 *
 * Weekday 8am cron checks the Notion content-calendar database for posts
 * scheduled today, posts a digest in #content-team, and flips the rows from
 * `scheduled` → `ready-for-publish` so the team knows exactly what's in the
 * day's queue.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'social-content-calendar-reminder',
  name: 'Social: Daily content calendar reminder',
  category: 'marketing',
  description:
    'Every weekday at 8am, query the Notion content calendar for today\'s posts, summarise them in Slack, and flip each row\'s status.',
  tags: ['social', 'notion', 'content-calendar', 'slack', 'reminder'],
  trigger: {
    id: 't_morning',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_tick',
    options: { cronExpression: '0 8 * * 1-5' },
  },
  variables: [
    { id: 'v_db_id', name: 'notion.dbId', defaultValue: 'a1b2c3d4e5f60718293a4b5c6d7e8f90' },
    { id: 'v_today', name: 'date.today', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_set_today',
      groupId: 'g_set',
      type: 'set_variable',
      options: { variableName: 'date.today', value: '{{ $now.format("YYYY-MM-DD") }}' },
    },
    {
      id: 'b_query',
      groupId: 'g_query',
      type: 'forge_notion',
      options: {
        action: 'database_query',
        databaseId: '{{notion.dbId}}',
        filter: {
          and: [
            { property: 'Publish Date', date: { equals: '{{date.today}}' } },
            { property: 'Status', status: { equals: 'scheduled' } },
          ],
        },
      },
    },
    {
      id: 'b_loop',
      groupId: 'g_loop',
      type: 'loop',
      options: { items: '{{ $json.results }}', itemVariable: 'post' },
    },
    {
      id: 'b_flip',
      groupId: 'g_flip',
      type: 'forge_notion',
      options: {
        action: 'page_update',
        pageId: '{{post.id}}',
        properties: {
          Status: { status: { name: 'ready-for-publish' } },
        },
      },
    },
    {
      id: 'b_digest',
      groupId: 'g_digest',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#content-team',
        text:
          ':calendar: *Today\'s content calendar ({{date.today}})*\n' +
          '{{ $json.results.length }} posts scheduled. Status flipped to *ready-for-publish*. ' +
          'See the queue: https://www.notion.so/{{notion.dbId}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
