/**
 * Recipe: Daily sweep → auto-close tickets idle for 14+ days.
 *
 * Cron runs nightly, asks the helpdesk for tickets in `pending` status
 * untouched for two weeks, and closes each one with a polite reason.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'support-auto-close-stale',
  name: 'Support: Auto-close stale tickets',
  category: 'support',
  description:
    'Every night, scan for pending tickets idle for 14+ days and auto-close them with a templated "marking resolved due to inactivity" reply.',
  tags: ['support', 'cleanup', 'sla', 'scheduled', 'helpdesk'],
  trigger: {
    id: 't_nightly_stale',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_daily',
    options: {
      cronExpression: '0 2 * * *',
      timezone: 'UTC',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_threshold_days', name: 'staleThresholdDays', defaultValue: '14' },
    { id: 'v_stale_ids', name: 'stale.ticketIds', defaultValue: '[]' },
  ],
  blocks: [
    {
      id: 'b_fetch',
      groupId: 'g_fetch',
      type: 'webhook',
      options: {
        url: '/api/crm/tickets/stale?days={{staleThresholdDays}}&status=pending',
        method: 'GET',
        responseVariable: 'v_stale_ids',
        responseMappings: [
          { id: 'rm1', jsonPath: 'ids', variableId: 'v_stale_ids' },
        ],
      },
    },
    {
      id: 'b_loop',
      groupId: 'g_loop',
      type: 'loop',
      options: {
        sourceVariable: 'stale.ticketIds',
        iteratorVariable: 'ticketId',
      },
    },
    {
      id: 'b_close',
      groupId: 'g_close',
      type: 'webhook',
      options: {
        url: '/api/crm/tickets/{{ticketId}}/close',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content:
            '{"reason":"auto-closed-stale","reply":"We haven\'t heard back in 14 days, so we\'re marking this ticket resolved. Reply any time to reopen it."}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
