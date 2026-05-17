/**
 * Step 47 — third seed-pack, bringing the template count from 20 → 40.
 *
 * Twenty production-shaped recipes covering the remaining "must-have"
 * automations we kept seeing tenants rebuild by hand: lifecycle marketing,
 * lead/renewal motion for revenue, ops cron rituals, and finance receipts.
 *
 * Same conventions as seed-pack-2:
 *   - kebab-case stable `id`
 *   - flat `blocks` list grouped by `groupId` (the registry lays groups out
 *     left-to-right and re-keys ids at instantiation time)
 *   - `{{ $json.body.* }}` for payload fields, `{{ variableName }}` for vars
 *   - forge_* block types that aren't in the BlockType union are cast via
 *     `as unknown as Recipe['blocks'][number]['type']` (see #1 / #6)
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const TEMPLATES: Recipe[] = [
  /* 1. Cart abandonment SMS recovery */
  {
    id: 'cart-abandonment-sms-recovery',
    name: 'Cart abandonment SMS recovery',
    category: 'ecommerce',
    description:
      'When a cart sits idle, wait 1h then text the shopper a recovery link. Skip if the cart was already converted.',
    tags: ['ecommerce', 'cart', 'sms', 'recovery', 'twilio'],
    trigger: {
      id: 't_cart_idle',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/cart/abandoned',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_phone', name: 'shopperPhone', defaultValue: '' },
      { id: 'v_cart', name: 'cartId', defaultValue: '' },
      { id: 'v_recover_url', name: 'recoverUrl', defaultValue: '' },
      { id: 'v_status', name: 'cartStatus', defaultValue: 'open' },
    ],
    blocks: [
      {
        id: 'b_extract_phone',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'shopperPhone', value: '{{ $json.body.customer.phone }}' },
      },
      {
        id: 'b_extract_cart',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'cartId', value: '{{ $json.body.cart.id }}' },
      },
      {
        id: 'b_extract_url',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'recoverUrl', value: '{{ $json.body.cart.recoverUrl }}' },
      },
      {
        id: 'b_wait',
        groupId: 'g_delay',
        type: 'wait',
        options: { secondsToWaitFor: 60 * 60 },
      },
      {
        id: 'b_still_open',
        groupId: 'g_check',
        type: 'condition',
        options: {
          logicalOperator: 'AND',
          conditionGroups: [
            {
              id: 'cg1',
              logicalOperator: 'AND',
              comparisons: [
                { id: 'c1', variableId: 'v_status', operator: 'Equal to', value: 'open' },
              ],
            },
          ],
        },
      },
      {
        id: 'b_sms',
        groupId: 'g_send',
        type: 'forge_twilio',
        options: {
          to: '{{shopperPhone}}',
          from: '+15551234567',
          body: 'You left something behind! Finish your order: {{recoverUrl}}',
        },
      },
    ],
  },

  /* 2. Subscription cancellation winback */
  {
    id: 'subscription-cancel-winback',
    name: 'Subscription cancellation winback',
    category: 'finance',
    description:
      'When a subscription cancels, wait 3 days, then email a 30%-off winback offer with a coupon code.',
    tags: ['subscription', 'churn', 'winback', 'email'],
    trigger: {
      id: 't_cancel',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/subscription/cancelled',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_email', name: 'customerEmail', defaultValue: '' },
      { id: 'v_name', name: 'customerName', defaultValue: 'there' },
      { id: 'v_plan', name: 'planName', defaultValue: '' },
      { id: 'v_coupon', name: 'couponCode', defaultValue: 'COMEBACK30' },
    ],
    blocks: [
      {
        id: 'b_extract_email',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'customerEmail', value: '{{ $json.body.customer.email }}' },
      },
      {
        id: 'b_extract_name',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'customerName', value: '{{ $json.body.customer.firstName }}' },
      },
      {
        id: 'b_extract_plan',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'planName', value: '{{ $json.body.subscription.plan }}' },
      },
      {
        id: 'b_wait',
        groupId: 'g_delay',
        type: 'wait',
        options: { secondsToWaitFor: 60 * 60 * 24 * 3 },
      },
      {
        id: 'b_email',
        groupId: 'g_send',
        type: 'send_email',
        options: {
          to: '{{customerEmail}}',
          subject: 'We miss you, {{customerName}} — here is 30% off',
          body:
            'Hey {{customerName}},\n\nWe noticed you cancelled {{planName}}. ' +
            'Come back any time in the next 14 days with code {{couponCode}} for 30% off your next 3 months.',
        },
      },
    ],
  },

  /* 3. Product launch announcement */
  {
    id: 'product-launch-announcement',
    name: 'Product launch announcement',
    category: 'marketing',
    description:
      'Multi-channel product launch — email the list, post to Slack, ping Twitter via webhook on launch day.',
    tags: ['launch', 'marketing', 'multichannel', 'email', 'slack'],
    trigger: {
      id: 't_launch',
      type: 'schedule',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'schedule_tick',
      options: { cronExpression: '0 14 1 6 *', enabled: true },
    },
    variables: [
      { id: 'v_list', name: 'listEmail', defaultValue: 'announce@example.com' },
      { id: 'v_product', name: 'productName', defaultValue: 'SabFlow 2.0' },
      { id: 'v_url', name: 'productUrl', defaultValue: 'https://example.com/launch' },
      { id: 'v_slack', name: 'slackWebhook', defaultValue: '' },
      { id: 'v_tweet_url', name: 'tweetWebhook', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_email',
        groupId: 'g_email',
        type: 'send_email',
        options: {
          to: '{{listEmail}}',
          subject: 'Introducing {{productName}}',
          body: '{{productName}} is here. Read more: {{productUrl}}',
        },
      },
      {
        id: 'b_slack',
        groupId: 'g_slack',
        type: 'webhook',
        options: {
          url: '{{slackWebhook}}',
          method: 'POST',
          body: {
            type: 'json',
            content: '{"text":":rocket: {{productName}} is LIVE — {{productUrl}}"}',
          },
        },
      },
      {
        id: 'b_tweet',
        groupId: 'g_tweet',
        type: 'webhook',
        options: {
          url: '{{tweetWebhook}}',
          method: 'POST',
          body: {
            type: 'json',
            content: '{"text":"{{productName}} just shipped. Try it: {{productUrl}}"}',
          },
        },
      },
    ],
  },

  /* 4. Birthday email automation */
  {
    id: 'birthday-email-automation',
    name: 'Birthday email automation',
    category: 'marketing',
    description:
      'Daily check finds customers with today as their birthday and sends a personalised gift-card email.',
    tags: ['birthday', 'marketing', 'email', 'lifecycle'],
    trigger: {
      id: 't_birthday_cron',
      type: 'schedule',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'schedule_tick',
      options: { cronExpression: '0 8 * * *', enabled: true },
    },
    variables: [
      { id: 'v_query_url', name: 'birthdayQueryUrl', defaultValue: 'https://api.example.com/customers/birthdays/today' },
      { id: 'v_token', name: 'apiToken', defaultValue: '' },
      { id: 'v_recipients', name: 'recipients', defaultValue: '' },
      { id: 'v_email', name: 'recipientEmail', defaultValue: '' },
      { id: 'v_name', name: 'recipientName', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_query',
        groupId: 'g_query',
        type: 'webhook',
        options: {
          url: '{{birthdayQueryUrl}}',
          method: 'GET',
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{apiToken}}' }],
          responseVariable: 'recipients',
        },
      },
      {
        id: 'b_loop',
        groupId: 'g_loop',
        type: 'loop',
        options: { items: '{{recipients}}', itemVariable: 'recipient' },
      },
      {
        id: 'b_set_email',
        groupId: 'g_loop',
        type: 'set_variable',
        options: { variableName: 'recipientEmail', value: '{{recipient.email}}' },
      },
      {
        id: 'b_set_name',
        groupId: 'g_loop',
        type: 'set_variable',
        options: { variableName: 'recipientName', value: '{{recipient.firstName}}' },
      },
      {
        id: 'b_email',
        groupId: 'g_send',
        type: 'send_email',
        options: {
          to: '{{recipientEmail}}',
          subject: 'Happy birthday, {{recipientName}}!',
          body: 'Enjoy a $25 gift card on us — use code BDAY25 at checkout. Have a great year ahead!',
        },
      },
    ],
  },

  /* 5. Inactive-user re-engagement */
  {
    id: 'inactive-user-reengagement',
    name: 'Inactive-user re-engagement',
    category: 'marketing',
    description:
      'When a user has been silent 30 days, send a "we miss you" email, wait 5 days, escalate to a discount.',
    tags: ['lifecycle', 'reengagement', 'email', 'drip'],
    trigger: {
      id: 't_inactive',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/user/inactive-30d',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_email', name: 'userEmail', defaultValue: '' },
      { id: 'v_name', name: 'userName', defaultValue: 'there' },
      { id: 'v_last_active', name: 'lastActive', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_email',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'userEmail', value: '{{ $json.body.user.email }}' },
      },
      {
        id: 'b_extract_name',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'userName', value: '{{ $json.body.user.firstName }}' },
      },
      {
        id: 'b_first',
        groupId: 'g_first',
        type: 'send_email',
        options: {
          to: '{{userEmail}}',
          subject: 'We miss you, {{userName}}',
          body: 'Hey {{userName}}, we noticed you have not been around since {{lastActive}}. Anything we can help with?',
        },
      },
      {
        id: 'b_wait',
        groupId: 'g_delay',
        type: 'wait',
        options: { secondsToWaitFor: 60 * 60 * 24 * 5 },
      },
      {
        id: 'b_second',
        groupId: 'g_second',
        type: 'send_email',
        options: {
          to: '{{userEmail}}',
          subject: 'Here is 20% off to come back',
          body: 'Use code WELCOMEBACK20 within 7 days to take 20% off your next plan.',
        },
      },
    ],
  },

  /* 6. Daily standup Slack reminder */
  {
    id: 'daily-standup-slack',
    name: 'Daily standup Slack reminder',
    category: 'ops',
    description:
      'Every weekday at 9:30 AM, post a Slack reminder with the three standup questions.',
    tags: ['standup', 'slack', 'schedule', 'ops'],
    trigger: {
      id: 't_standup',
      type: 'schedule',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'schedule_tick',
      options: { cronExpression: '30 9 * * 1-5', enabled: true },
    },
    variables: [
      { id: 'v_hook', name: 'slackWebhook', defaultValue: '' },
      { id: 'v_channel', name: 'channel', defaultValue: '#standup' },
    ],
    blocks: [
      {
        id: 'b_post',
        groupId: 'g_post',
        type: 'webhook',
        options: {
          url: '{{slackWebhook}}',
          method: 'POST',
          body: {
            type: 'json',
            content:
              '{"channel":"{{channel}}","text":":coffee: *Standup time* — drop your thread:\\n1. What did you ship yesterday?\\n2. What are you shipping today?\\n3. Any blockers?"}',
          },
        },
      },
    ],
  },

  /* 7. Weekly KPI digest email */
  {
    id: 'weekly-kpi-digest',
    name: 'Weekly KPI digest email',
    category: 'finance',
    description:
      'Every Monday 7 AM, pull this week\'s KPIs from the metrics API and email a summary to the leadership list.',
    tags: ['kpi', 'digest', 'finance', 'schedule', 'reporting'],
    trigger: {
      id: 't_kpi',
      type: 'schedule',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'schedule_tick',
      options: { cronExpression: '0 7 * * 1', enabled: true },
    },
    variables: [
      { id: 'v_url', name: 'kpiUrl', defaultValue: 'https://api.example.com/metrics/weekly' },
      { id: 'v_token', name: 'apiToken', defaultValue: '' },
      { id: 'v_metrics', name: 'metrics', defaultValue: '' },
      { id: 'v_recipients', name: 'recipients', defaultValue: 'leadership@example.com' },
    ],
    blocks: [
      {
        id: 'b_fetch',
        groupId: 'g_fetch',
        type: 'webhook',
        options: {
          url: '{{kpiUrl}}',
          method: 'GET',
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{apiToken}}' }],
          responseVariable: 'metrics',
        },
      },
      {
        id: 'b_email',
        groupId: 'g_email',
        type: 'send_email',
        options: {
          to: '{{recipients}}',
          subject: 'Weekly KPI digest',
          body:
            'MRR: {{metrics.mrr}}\nNew signups: {{metrics.signups}}\nChurn: {{metrics.churn}}\n' +
            'Active users: {{metrics.activeUsers}}\nNPS: {{metrics.nps}}',
        },
      },
    ],
  },

  /* 8. Lead scoring + assignment */
  {
    id: 'lead-scoring-assignment',
    name: 'Lead scoring + assignment',
    category: 'sales',
    description:
      'New lead hits webhook → score by company size + intent → route hot leads to AE rotation, others to nurture.',
    tags: ['lead', 'scoring', 'routing', 'sales'],
    trigger: {
      id: 't_lead',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/lead/new',
        method: 'POST',
        authentication: 'none',
        responseMode: 'lastNode',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_email', name: 'leadEmail', defaultValue: '' },
      { id: 'v_company_size', name: 'companySize', defaultValue: '0' },
      { id: 'v_intent', name: 'intent', defaultValue: 'low' },
      { id: 'v_score', name: 'score', defaultValue: '0' },
      { id: 'v_assign_url', name: 'assignUrl', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'leadEmail', value: '{{ $json.body.email }}' },
      },
      {
        id: 'b_extract_size',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'companySize', value: '{{ $json.body.companySize }}' },
      },
      {
        id: 'b_extract_intent',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'intent', value: '{{ $json.body.intent }}' },
      },
      {
        id: 'b_score',
        groupId: 'g_score',
        type: 'script',
        options: {
          name: 'score-lead',
          content:
            'let s = 0;\n' +
            "if (Number(companySize) >= 200) s += 50;\n" +
            "if (intent === 'high') s += 40;\n" +
            'return { score: s };',
          outputVariableId: 'v_score',
        },
      },
      {
        id: 'b_hot',
        groupId: 'g_branch',
        type: 'condition',
        options: {
          logicalOperator: 'AND',
          conditionGroups: [
            {
              id: 'cg',
              logicalOperator: 'AND',
              comparisons: [
                { id: 'c', variableId: 'v_score', operator: 'Greater than or equal', value: '60' },
              ],
            },
          ],
        },
      },
      {
        id: 'b_assign',
        groupId: 'g_assign',
        type: 'webhook',
        options: {
          url: '{{assignUrl}}',
          method: 'POST',
          body: {
            type: 'json',
            content: '{"email":"{{leadEmail}}","score":{{score}},"queue":"ae-rotation"}',
          },
        },
      },
    ],
  },

  /* 9. Sales handoff to CSM */
  {
    id: 'sales-handoff-to-csm',
    name: 'Sales handoff to CSM',
    category: 'sales',
    description:
      'When a deal closes, post the account brief to Slack #cs-handoffs and email the assigned CSM.',
    tags: ['handoff', 'csm', 'sales', 'slack'],
    trigger: {
      id: 't_closed',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/deal/closed-won',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_account', name: 'accountName', defaultValue: '' },
      { id: 'v_acv', name: 'acv', defaultValue: '0' },
      { id: 'v_csm_email', name: 'csmEmail', defaultValue: '' },
      { id: 'v_brief_url', name: 'briefUrl', defaultValue: '' },
      { id: 'v_slack', name: 'slackWebhook', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_account',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'accountName', value: '{{ $json.body.deal.accountName }}' },
      },
      {
        id: 'b_extract_acv',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'acv', value: '{{ $json.body.deal.acv }}' },
      },
      {
        id: 'b_extract_csm',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'csmEmail', value: '{{ $json.body.deal.csmEmail }}' },
      },
      {
        id: 'b_slack',
        groupId: 'g_slack',
        type: 'webhook',
        options: {
          url: '{{slackWebhook}}',
          method: 'POST',
          body: {
            type: 'json',
            content:
              '{"text":":handshake: New CS handoff — *{{accountName}}* (ACV {{acv}}). Brief: {{briefUrl}}"}',
          },
        },
      },
      {
        id: 'b_email',
        groupId: 'g_email',
        type: 'send_email',
        options: {
          to: '{{csmEmail}}',
          subject: 'CS handoff: {{accountName}}',
          body: 'You\'ve been assigned {{accountName}} (ACV {{acv}}). Account brief: {{briefUrl}}',
        },
      },
    ],
  },

  /* 10. Renewal reminder 30/14/7 days out */
  {
    id: 'renewal-reminder-30-14-7',
    name: 'Renewal reminder 30/14/7 days out',
    category: 'sales',
    description:
      'When a subscription is 30 days from renewal, send T-30, then T-14, then T-7 email reminders.',
    tags: ['renewal', 'reminder', 'drip', 'sales'],
    trigger: {
      id: 't_renewal',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/subscription/renewal-30d',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_email', name: 'customerEmail', defaultValue: '' },
      { id: 'v_plan', name: 'planName', defaultValue: '' },
      { id: 'v_renews', name: 'renewsOn', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_email',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'customerEmail', value: '{{ $json.body.customer.email }}' },
      },
      {
        id: 'b_extract_plan',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'planName', value: '{{ $json.body.subscription.plan }}' },
      },
      {
        id: 'b_t30',
        groupId: 'g_t30',
        type: 'send_email',
        options: {
          to: '{{customerEmail}}',
          subject: 'Your {{planName}} renews in 30 days',
          body: 'Just a heads up — {{planName}} renews on {{renewsOn}}. Reply if you need any changes.',
        },
      },
      {
        id: 'b_wait_16',
        groupId: 'g_wait1',
        type: 'wait',
        options: { secondsToWaitFor: 60 * 60 * 24 * 16 },
      },
      {
        id: 'b_t14',
        groupId: 'g_t14',
        type: 'send_email',
        options: {
          to: '{{customerEmail}}',
          subject: 'Reminder: {{planName}} renews in 14 days',
          body: 'Renewal date is {{renewsOn}}. Let us know if you want to adjust seats or plan.',
        },
      },
      {
        id: 'b_wait_7',
        groupId: 'g_wait2',
        type: 'wait',
        options: { secondsToWaitFor: 60 * 60 * 24 * 7 },
      },
      {
        id: 'b_t7',
        groupId: 'g_t7',
        type: 'send_email',
        options: {
          to: '{{customerEmail}}',
          subject: 'One week until your {{planName}} renews',
          body: 'Final reminder — {{planName}} renews on {{renewsOn}}. No action needed unless you want to change.',
        },
      },
    ],
  },

  /* 11. Refund request handler */
  {
    id: 'refund-request-handler',
    name: 'Refund request handler',
    category: 'support',
    description:
      'Refund webhook → if under $50 auto-approve via finance API, else route to ops Slack for review.',
    tags: ['refund', 'support', 'finance', 'routing'],
    trigger: {
      id: 't_refund',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/refund/request',
        method: 'POST',
        authentication: 'none',
        responseMode: 'lastNode',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_amount', name: 'amountCents', defaultValue: '0' },
      { id: 'v_order', name: 'orderId', defaultValue: '' },
      { id: 'v_customer', name: 'customerEmail', defaultValue: '' },
      { id: 'v_api', name: 'refundApi', defaultValue: 'https://api.example.com/refunds' },
      { id: 'v_token', name: 'apiToken', defaultValue: '' },
      { id: 'v_slack', name: 'slackWebhook', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_amount',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'amountCents', value: '{{ $json.body.amountCents }}' },
      },
      {
        id: 'b_extract_order',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'orderId', value: '{{ $json.body.orderId }}' },
      },
      {
        id: 'b_extract_email',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'customerEmail', value: '{{ $json.body.customer.email }}' },
      },
      {
        id: 'b_small',
        groupId: 'g_branch',
        type: 'condition',
        options: {
          logicalOperator: 'AND',
          conditionGroups: [
            {
              id: 'cg',
              logicalOperator: 'AND',
              comparisons: [
                { id: 'c', variableId: 'v_amount', operator: 'Less than or equal', value: '5000' },
              ],
            },
          ],
        },
      },
      {
        id: 'b_auto',
        groupId: 'g_auto',
        type: 'webhook',
        options: {
          url: '{{refundApi}}',
          method: 'POST',
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{apiToken}}' }],
          body: {
            type: 'json',
            content: '{"orderId":"{{orderId}}","amountCents":{{amountCents}},"reason":"auto-approved"}',
          },
        },
      },
      {
        id: 'b_review',
        groupId: 'g_review',
        type: 'webhook',
        options: {
          url: '{{slackWebhook}}',
          method: 'POST',
          body: {
            type: 'json',
            content:
              '{"text":":money_with_wings: Refund needs review — order {{orderId}} for {{amountCents}}c from {{customerEmail}}"}',
          },
        },
      },
    ],
  },

  /* 12. SLA breach escalation */
  {
    id: 'sla-breach-escalation',
    name: 'SLA breach escalation',
    category: 'support',
    description:
      'Hourly check finds tickets past their SLA → page the on-call manager via PagerDuty webhook.',
    tags: ['sla', 'support', 'escalation', 'pagerduty'],
    trigger: {
      id: 't_sla_cron',
      type: 'schedule',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'schedule_tick',
      options: { cronExpression: '0 * * * *', enabled: true },
    },
    variables: [
      { id: 'v_query', name: 'breachQueryUrl', defaultValue: 'https://api.example.com/tickets/breached' },
      { id: 'v_token', name: 'apiToken', defaultValue: '' },
      { id: 'v_breaches', name: 'breaches', defaultValue: '' },
      { id: 'v_count', name: 'breachCount', defaultValue: '0' },
      { id: 'v_pd_url', name: 'pagerDutyUrl', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_query',
        groupId: 'g_query',
        type: 'webhook',
        options: {
          url: '{{breachQueryUrl}}',
          method: 'GET',
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{apiToken}}' }],
          responseVariable: 'breaches',
        },
      },
      {
        id: 'b_count',
        groupId: 'g_count',
        type: 'set_variable',
        options: { variableName: 'breachCount', value: '{{breaches.length}}' },
      },
      {
        id: 'b_any',
        groupId: 'g_branch',
        type: 'condition',
        options: {
          logicalOperator: 'AND',
          conditionGroups: [
            {
              id: 'cg',
              logicalOperator: 'AND',
              comparisons: [
                { id: 'c', variableId: 'v_count', operator: 'Greater than', value: '0' },
              ],
            },
          ],
        },
      },
      {
        id: 'b_page',
        groupId: 'g_page',
        type: 'webhook',
        options: {
          url: '{{pagerDutyUrl}}',
          method: 'POST',
          body: {
            type: 'json',
            content:
              '{"event_action":"trigger","payload":{"summary":"SLA breach: {{breachCount}} tickets over deadline","severity":"error","source":"sabflow"}}',
          },
        },
      },
    ],
  },

  /* 13. New employee onboarding checklist */
  {
    id: 'new-employee-onboarding-checklist',
    name: 'New employee onboarding checklist',
    category: 'onboarding',
    description:
      'When HR adds a new hire, fan-out: create email + accounts, post a welcome in Slack, and email the buddy.',
    tags: ['hr', 'onboarding', 'checklist', 'employee'],
    trigger: {
      id: 't_new_hire',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/hr/new-hire',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_name', name: 'employeeName', defaultValue: '' },
      { id: 'v_email', name: 'employeeEmail', defaultValue: '' },
      { id: 'v_role', name: 'role', defaultValue: '' },
      { id: 'v_buddy_email', name: 'buddyEmail', defaultValue: '' },
      { id: 'v_provision_url', name: 'provisionUrl', defaultValue: '' },
      { id: 'v_slack', name: 'slackWebhook', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_name',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'employeeName', value: '{{ $json.body.employee.fullName }}' },
      },
      {
        id: 'b_extract_email',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'employeeEmail', value: '{{ $json.body.employee.email }}' },
      },
      {
        id: 'b_extract_role',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'role', value: '{{ $json.body.employee.role }}' },
      },
      {
        id: 'b_provision',
        groupId: 'g_provision',
        type: 'webhook',
        options: {
          url: '{{provisionUrl}}',
          method: 'POST',
          body: {
            type: 'json',
            content: '{"email":"{{employeeEmail}}","role":"{{role}}","groups":["all","new-hires"]}',
          },
        },
      },
      {
        id: 'b_welcome',
        groupId: 'g_welcome',
        type: 'send_email',
        options: {
          to: '{{employeeEmail}}',
          subject: 'Welcome to the team, {{employeeName}}!',
          body:
            'We\'re thrilled to have you join us as {{role}}. ' +
            'Your buddy is {{buddyEmail}} — they\'ll reach out today. Day-one guide will follow shortly.',
        },
      },
      {
        id: 'b_buddy',
        groupId: 'g_buddy',
        type: 'send_email',
        options: {
          to: '{{buddyEmail}}',
          subject: 'You\'re onboarding {{employeeName}}',
          body: 'Please reach out to {{employeeName}} ({{employeeEmail}}) today to schedule a coffee chat.',
        },
      },
      {
        id: 'b_slack',
        groupId: 'g_slack',
        type: 'webhook',
        options: {
          url: '{{slackWebhook}}',
          method: 'POST',
          body: {
            type: 'json',
            content:
              '{"text":":wave: Welcome *{{employeeName}}* ({{role}}) to the team!"}',
          },
        },
      },
    ],
  },

  /* 14. Employee offboarding cleanup */
  {
    id: 'employee-offboarding-cleanup',
    name: 'Employee offboarding cleanup',
    category: 'ops',
    description:
      'When HR marks an employee as departed, revoke SaaS accounts, archive Slack, and confirm to IT.',
    tags: ['hr', 'offboarding', 'security', 'cleanup'],
    trigger: {
      id: 't_offboard',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/hr/offboard',
        method: 'POST',
        authentication: 'none',
        responseMode: 'lastNode',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_email', name: 'employeeEmail', defaultValue: '' },
      { id: 'v_name', name: 'employeeName', defaultValue: '' },
      { id: 'v_revoke_url', name: 'revokeUrl', defaultValue: '' },
      { id: 'v_slack_archive', name: 'slackArchiveUrl', defaultValue: '' },
      { id: 'v_it_email', name: 'itEmail', defaultValue: 'it@example.com' },
    ],
    blocks: [
      {
        id: 'b_extract_email',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'employeeEmail', value: '{{ $json.body.employee.email }}' },
      },
      {
        id: 'b_extract_name',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'employeeName', value: '{{ $json.body.employee.fullName }}' },
      },
      {
        id: 'b_revoke',
        groupId: 'g_revoke',
        type: 'webhook',
        options: {
          url: '{{revokeUrl}}',
          method: 'POST',
          body: { type: 'json', content: '{"email":"{{employeeEmail}}","action":"revoke-all"}' },
        },
      },
      {
        id: 'b_archive',
        groupId: 'g_archive',
        type: 'webhook',
        options: {
          url: '{{slackArchiveUrl}}',
          method: 'POST',
          body: { type: 'json', content: '{"email":"{{employeeEmail}}","action":"deactivate"}' },
        },
      },
      {
        id: 'b_confirm',
        groupId: 'g_confirm',
        type: 'send_email',
        options: {
          to: '{{itEmail}}',
          subject: 'Offboarding complete: {{employeeName}}',
          body: 'Accounts and Slack for {{employeeEmail}} have been revoked. Please confirm laptop return.',
        },
      },
    ],
  },

  /* 15. Feature request triage */
  {
    id: 'feature-request-triage',
    name: 'Feature request triage',
    category: 'ops',
    description:
      'New feature request → OpenAI categorises (ui/api/perf/other) → POST to product board with the tag.',
    tags: ['product', 'triage', 'openai', 'feature'],
    trigger: {
      id: 't_feature',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/feature-request',
        method: 'POST',
        authentication: 'none',
        responseMode: 'lastNode',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_title', name: 'requestTitle', defaultValue: '' },
      { id: 'v_body', name: 'requestBody', defaultValue: '' },
      { id: 'v_category', name: 'category', defaultValue: '' },
      { id: 'v_board_url', name: 'boardUrl', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_title',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'requestTitle', value: '{{ $json.body.title }}' },
      },
      {
        id: 'b_extract_body',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'requestBody', value: '{{ $json.body.description }}' },
      },
      {
        id: 'b_classify',
        groupId: 'g_ai',
        type: 'open_ai',
        options: {
          model: 'gpt-4o-mini',
          task: 'ask_assistant',
          systemPrompt:
            'Classify this feature request into exactly one label: ui, api, perf, other. Respond with only the label.',
          userMessage: '{{requestTitle}}\n\n{{requestBody}}',
          responseVariable: 'category',
        },
      },
      {
        id: 'b_post',
        groupId: 'g_post',
        type: 'webhook',
        options: {
          url: '{{boardUrl}}',
          method: 'POST',
          body: {
            type: 'json',
            content:
              '{"title":"{{requestTitle}}","body":"{{requestBody}}","labels":["{{category}}"]}',
          },
        },
      },
    ],
  },

  /* 16. Bug report intake form */
  {
    id: 'bug-report-intake',
    name: 'Bug report intake form',
    category: 'support',
    description:
      'Public bug form → collect repro steps + severity → file a GitHub issue and acknowledge the reporter.',
    tags: ['bug', 'support', 'github', 'intake'],
    trigger: {
      id: 't_bug',
      type: 'start',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'flow_started',
      options: { enabled: true },
    },
    variables: [
      { id: 'v_reporter', name: 'reporterEmail', defaultValue: '' },
      { id: 'v_summary', name: 'bugSummary', defaultValue: '' },
      { id: 'v_steps', name: 'reproSteps', defaultValue: '' },
      { id: 'v_severity', name: 'severity', defaultValue: '' },
      { id: 'v_repo', name: 'repo', defaultValue: 'owner/repo' },
      { id: 'v_gh_token', name: 'githubToken', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_ask_email',
        groupId: 'g_collect',
        type: 'email_input',
        options: {
          placeholder: 'your@email.com',
          buttonLabel: 'Next',
          variableId: 'v_reporter',
        },
      },
      {
        id: 'b_ask_summary',
        groupId: 'g_collect',
        type: 'text_input',
        options: {
          placeholder: 'One-line summary',
          buttonLabel: 'Next',
          variableId: 'v_summary',
        },
      },
      {
        id: 'b_ask_steps',
        groupId: 'g_collect',
        type: 'text_input',
        options: {
          placeholder: 'Steps to reproduce',
          buttonLabel: 'Next',
          variableId: 'v_steps',
          isLong: true,
        },
      },
      {
        id: 'b_ask_severity',
        groupId: 'g_collect',
        type: 'choice_input',
        options: { buttonLabel: 'Submit' },
        items: [
          { id: 'i_low', content: 'low' },
          { id: 'i_med', content: 'medium' },
          { id: 'i_high', content: 'high' },
          { id: 'i_crit', content: 'critical' },
        ],
      },
      {
        id: 'b_file',
        groupId: 'g_file',
        type: 'webhook',
        options: {
          url: 'https://api.github.com/repos/{{repo}}/issues',
          method: 'POST',
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{githubToken}}' }],
          body: {
            type: 'json',
            content:
              '{"title":"[bug] {{bugSummary}}","body":"Reporter: {{reporterEmail}}\\n\\nSeverity: {{severity}}\\n\\n## Steps\\n{{reproSteps}}","labels":["bug","{{severity}}"]}',
          },
        },
      },
      {
        id: 'b_ack',
        groupId: 'g_ack',
        type: 'send_email',
        options: {
          to: '{{reporterEmail}}',
          subject: 'Thanks — we got your bug report',
          body: 'Thanks for reporting "{{bugSummary}}". We\'ve filed a ticket and will follow up.',
        },
      },
    ],
  },

  /* 17. Free-trial expiry reminder */
  {
    id: 'free-trial-expiry-reminder',
    name: 'Free-trial expiry reminder',
    category: 'finance',
    description:
      'T-3 days from trial expiry, email the customer with an upgrade CTA. T-1 day, ping again with urgency.',
    tags: ['trial', 'expiry', 'finance', 'lifecycle'],
    trigger: {
      id: 't_trial_3d',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/trial/expires-in-3d',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_email', name: 'customerEmail', defaultValue: '' },
      { id: 'v_name', name: 'customerName', defaultValue: 'there' },
      { id: 'v_upgrade_url', name: 'upgradeUrl', defaultValue: 'https://example.com/upgrade' },
    ],
    blocks: [
      {
        id: 'b_extract_email',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'customerEmail', value: '{{ $json.body.user.email }}' },
      },
      {
        id: 'b_extract_name',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'customerName', value: '{{ $json.body.user.firstName }}' },
      },
      {
        id: 'b_d3',
        groupId: 'g_d3',
        type: 'send_email',
        options: {
          to: '{{customerEmail}}',
          subject: 'Your trial ends in 3 days, {{customerName}}',
          body: 'Pick a plan to keep your data and integrations: {{upgradeUrl}}',
        },
      },
      {
        id: 'b_wait',
        groupId: 'g_wait',
        type: 'wait',
        options: { secondsToWaitFor: 60 * 60 * 24 * 2 },
      },
      {
        id: 'b_d1',
        groupId: 'g_d1',
        type: 'send_email',
        options: {
          to: '{{customerEmail}}',
          subject: 'Last day — your trial ends tomorrow',
          body: 'Upgrade in two clicks: {{upgradeUrl}}. After tomorrow, your workspace becomes read-only.',
        },
      },
    ],
  },

  /* 18. Receipt auto-email after Stripe charge */
  {
    id: 'stripe-receipt-auto-email',
    name: 'Receipt auto-email after Stripe charge',
    category: 'finance',
    description:
      'On Stripe charge.succeeded webhook, format a receipt and email it to the customer.',
    tags: ['stripe', 'receipt', 'finance', 'email'],
    trigger: {
      id: 't_charged',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/stripe/charge-succeeded',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_email', name: 'customerEmail', defaultValue: '' },
      { id: 'v_name', name: 'customerName', defaultValue: '' },
      { id: 'v_amount', name: 'amountFormatted', defaultValue: '' },
      { id: 'v_charge', name: 'chargeId', defaultValue: '' },
      { id: 'v_desc', name: 'description', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_email',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'customerEmail', value: '{{ $json.body.data.object.receipt_email }}' },
      },
      {
        id: 'b_extract_amount',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'amountFormatted', value: '{{ $json.body.data.object.amount }}' },
      },
      {
        id: 'b_extract_charge',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'chargeId', value: '{{ $json.body.data.object.id }}' },
      },
      {
        id: 'b_extract_desc',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'description', value: '{{ $json.body.data.object.description }}' },
      },
      {
        id: 'b_email',
        groupId: 'g_email',
        type: 'send_email',
        options: {
          to: '{{customerEmail}}',
          subject: 'Your receipt — {{chargeId}}',
          body:
            'Thanks for your payment of {{amountFormatted}} for "{{description}}". ' +
            'Charge reference: {{chargeId}}. Keep this email for your records.',
        },
      },
    ],
  },

  /* 19. Out-of-office auto-reply */
  {
    id: 'out-of-office-auto-reply',
    name: 'Out-of-office auto-reply',
    category: 'ops',
    description:
      'Inbound email webhook → check OOO window via variables → auto-respond with delegate info.',
    tags: ['ooo', 'email', 'auto-reply', 'ops'],
    trigger: {
      id: 't_inbound',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/email/inbound',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_from', name: 'fromEmail', defaultValue: '' },
      { id: 'v_subject', name: 'subject', defaultValue: '' },
      { id: 'v_ooo_active', name: 'oooActive', defaultValue: 'true' },
      { id: 'v_return', name: 'returnDate', defaultValue: '' },
      { id: 'v_delegate', name: 'delegateEmail', defaultValue: 'team@example.com' },
    ],
    blocks: [
      {
        id: 'b_extract_from',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'fromEmail', value: '{{ $json.body.from }}' },
      },
      {
        id: 'b_extract_subject',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'subject', value: '{{ $json.body.subject }}' },
      },
      {
        id: 'b_active',
        groupId: 'g_check',
        type: 'condition',
        options: {
          logicalOperator: 'AND',
          conditionGroups: [
            {
              id: 'cg',
              logicalOperator: 'AND',
              comparisons: [
                { id: 'c', variableId: 'v_ooo_active', operator: 'Equal to', value: 'true' },
              ],
            },
          ],
        },
      },
      {
        id: 'b_reply',
        groupId: 'g_reply',
        type: 'send_email',
        options: {
          to: '{{fromEmail}}',
          subject: 'Re: {{subject}} — Out of office',
          body:
            'Thanks for your note. I\'m currently out and will respond after {{returnDate}}. ' +
            'For anything urgent, please reach out to {{delegateEmail}}.',
        },
      },
    ],
  },

  /* 20. Cold outreach drip — 3 emails over 7 days */
  {
    id: 'cold-outreach-drip-7d',
    name: 'Cold outreach drip (3 emails / 7 days)',
    category: 'sales',
    description:
      'Sequential cold-email cadence: intro on day 0, value-add on day 3, breakup on day 7. Wait blocks gate each step.',
    tags: ['outbound', 'drip', 'sales', 'cold-email'],
    trigger: {
      id: 't_outbound',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/outbound/start',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_email', name: 'prospectEmail', defaultValue: '' },
      { id: 'v_name', name: 'prospectName', defaultValue: 'there' },
      { id: 'v_company', name: 'company', defaultValue: '' },
      { id: 'v_rep', name: 'repName', defaultValue: 'Alex' },
    ],
    blocks: [
      {
        id: 'b_extract_email',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'prospectEmail', value: '{{ $json.body.prospect.email }}' },
      },
      {
        id: 'b_extract_name',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'prospectName', value: '{{ $json.body.prospect.firstName }}' },
      },
      {
        id: 'b_extract_company',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'company', value: '{{ $json.body.prospect.company }}' },
      },
      {
        id: 'b_d0',
        groupId: 'g_d0',
        type: 'send_email',
        options: {
          to: '{{prospectEmail}}',
          subject: 'Quick idea for {{company}}',
          body:
            'Hi {{prospectName}},\n\nI run growth at SabNode and noticed {{company}} — ' +
            'I had one specific idea to share. Worth a 15-min chat next week?\n\n— {{repName}}',
        },
      },
      {
        id: 'b_wait_3',
        groupId: 'g_wait1',
        type: 'wait',
        options: { secondsToWaitFor: 60 * 60 * 24 * 3 },
      },
      {
        id: 'b_d3',
        groupId: 'g_d3',
        type: 'send_email',
        options: {
          to: '{{prospectEmail}}',
          subject: 'Re: Quick idea for {{company}}',
          body:
            'Hey {{prospectName}}, popping this back to the top. Here\'s a one-pager on what we did for a peer of {{company}}: https://example.com/casestudy.',
        },
      },
      {
        id: 'b_wait_4',
        groupId: 'g_wait2',
        type: 'wait',
        options: { secondsToWaitFor: 60 * 60 * 24 * 4 },
      },
      {
        id: 'b_d7',
        groupId: 'g_d7',
        type: 'send_email',
        options: {
          to: '{{prospectEmail}}',
          subject: 'Closing the loop',
          body:
            'Hi {{prospectName}} — I don\'t want to clutter your inbox. ' +
            'If now isn\'t the right time, just reply "later" and I\'ll circle back in Q3. All the best, {{repName}}.',
        },
      },
    ],
  },
];

for (const t of TEMPLATES) registerRecipe(t);
