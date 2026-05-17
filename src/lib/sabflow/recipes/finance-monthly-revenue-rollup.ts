/**
 * Recipe: Monthly revenue rollup → Google Sheet + Slack summary.
 *
 * Cron fires at 7am UTC on the 1st of every month, pulls last month's MRR /
 * ARR / new-logo counts from the internal billing rollup endpoint, appends a
 * row to a Google Sheet, and posts a digest in #finance.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'finance-monthly-revenue-rollup',
  name: 'Finance: Monthly revenue rollup',
  category: 'finance',
  description:
    'On the 1st of each month, pull MRR/ARR/new-logo totals, append a row to a Google Sheet, and post a #finance summary in Slack.',
  tags: ['finance', 'revenue', 'mrr', 'sheets', 'slack'],
  trigger: {
    id: 't_first_of_month',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_tick',
    options: { cronExpression: '0 7 1 * *' },
  },
  variables: [
    { id: 'v_sheet_id', name: 'sheet.id', defaultValue: '1aBcDeFgHiJkLmNoPqRsTuVwXyZ' },
    { id: 'v_range', name: 'sheet.range', defaultValue: 'Monthly!A:F' },
  ],
  blocks: [
    {
      id: 'b_pull',
      groupId: 'g_pull',
      type: 'webhook',
      options: {
        url: '/api/finance/rollup?period=last_month',
        method: 'GET',
        headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{INTERNAL_TOKEN}}' }],
      },
    },
    {
      id: 'b_append',
      groupId: 'g_append',
      type: 'webhook',
      options: {
        url: 'https://sheets.googleapis.com/v4/spreadsheets/{{sheet.id}}/values/{{sheet.range}}:append?valueInputOption=USER_ENTERED',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{GOOGLE_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"values":[["{{ $json.month }}","{{ $json.mrr }}","{{ $json.arr }}","{{ $json.newLogos }}","{{ $json.churnedLogos }}","{{ $json.netNewMrr }}"]]}',
        },
      },
    },
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#finance',
        text:
          ':chart_with_upwards_trend: *{{ $json.month }} revenue rollup*\n' +
          '• MRR: {{ $json.mrr }} (net new: {{ $json.netNewMrr }})\n' +
          '• ARR: {{ $json.arr }}\n' +
          '• New logos: {{ $json.newLogos }} | Churned: {{ $json.churnedLogos }}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
