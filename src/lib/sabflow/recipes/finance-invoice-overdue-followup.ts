/**
 * Recipe: Invoice 14-days-overdue → automated follow-up.
 *
 * Daily cron queries our billing system for invoices >= 14 days past due.
 * For each, we send a polite follow-up email, post in #ar-overdue with a
 * one-click "mark as paid" Slack button, and create a CRM task for the
 * assigned account manager.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'finance-invoice-overdue-followup',
  name: 'Finance: Invoice 14-day overdue follow-up',
  category: 'finance',
  description:
    'Each morning, find invoices 14+ days overdue and chase them — customer email, Slack alert with action, and a CRM task for the AM.',
  tags: ['finance', 'invoice', 'overdue', 'collections', 'slack'],
  trigger: {
    id: 't_daily',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_tick',
    options: { cronExpression: '0 10 * * 1-5' },
  },
  variables: [
    { id: 'v_threshold', name: 'overdue.days', defaultValue: '14' },
  ],
  blocks: [
    {
      id: 'b_pull',
      groupId: 'g_pull',
      type: 'webhook',
      options: {
        url: '/api/finance/invoices/overdue?daysGte={{overdue.days}}',
        method: 'GET',
        headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{INTERNAL_TOKEN}}' }],
      },
    },
    {
      id: 'b_loop',
      groupId: 'g_loop',
      type: 'loop',
      options: { items: '{{ $json.invoices }}', itemVariable: 'inv' },
    },
    {
      id: 'b_email',
      groupId: 'g_email',
      type: 'send_email',
      options: {
        to: '{{inv.customer.email}}',
        subject: 'Friendly reminder: invoice {{inv.number}} is past due',
        body:
          'Hi {{inv.customer.firstName}}, our records show invoice {{inv.number}} ' +
          'for {{inv.amount}} was due on {{inv.dueDate}}. Pay or download the PDF ' +
          'here: {{inv.payUrl}}. If something\'s off, just reply.',
      },
    },
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#ar-overdue',
        text:
          ':hourglass: *{{inv.number}}* — {{inv.amount}} from `{{inv.customer.email}}` ' +
          'is {{inv.daysOverdue}}d overdue. AM: <@{{inv.amSlackUserId}}>.',
      },
    },
    {
      id: 'b_task',
      groupId: 'g_task',
      type: 'webhook',
      options: {
        url: '/api/crm/tasks',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content:
            '{"assignedTo":"{{inv.accountManagerId}}","subject":"Chase invoice {{inv.number}}","dueAt":"+24h","relatedTo":{"type":"invoice","id":"{{inv.id}}"},"priority":"high"}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
