/**
 * Recipe: Daily birthday / work-anniversary Slack post.
 *
 * Cron at 09:00 hits the HRIS for today's birthdays and anniversaries
 * and posts a celebration to the #celebrations channel.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'hr-birthday-anniversary-slack',
  name: 'HR: Birthday & anniversary Slack post',
  category: 'onboarding',
  description:
    'Every morning at 09:00, fetch today\'s birthdays and work-anniversaries from the HRIS and post a celebration message to the #celebrations Slack channel.',
  tags: ['hr', 'slack', 'birthdays', 'anniversaries', 'culture'],
  trigger: {
    id: 't_celebrations',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_daily',
    options: {
      cronExpression: '0 9 * * *',
      timezone: 'America/Los_Angeles',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_birthdays', name: 'today.birthdays', defaultValue: '' },
    { id: 'v_anniversaries', name: 'today.anniversaries', defaultValue: '' },
    { id: 'v_count', name: 'today.totalCount', defaultValue: '0' },
  ],
  blocks: [
    {
      id: 'b_fetch',
      groupId: 'g_fetch',
      type: 'webhook',
      options: {
        url: '/api/hr/celebrations/today',
        method: 'GET',
        responseMappings: [
          { id: 'rm1', jsonPath: 'birthdaysFormatted', variableId: 'v_birthdays' },
          { id: 'rm2', jsonPath: 'anniversariesFormatted', variableId: 'v_anniversaries' },
          { id: 'rm3', jsonPath: 'totalCount', variableId: 'v_count' },
        ],
      },
    },
    {
      id: 'b_branch',
      groupId: 'g_branch',
      type: 'condition',
      options: {
        logicalOperator: 'AND',
        conditionGroups: [
          {
            id: 'cg1',
            logicalOperator: 'AND',
            comparisons: [
              {
                id: 'c1',
                variableId: 'v_count',
                operator: 'Greater than',
                value: '0',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#celebrations',
        text:
          ':tada: *Today\'s celebrations*\n' +
          ':birthday: Birthdays: {{today.birthdays}}\n' +
          ':trophy: Work anniversaries: {{today.anniversaries}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
