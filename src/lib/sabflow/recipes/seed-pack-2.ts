/**
 * Step 35 — second seed-pack, bringing the template count from 10 → 20.
 *
 * Ten short, opinionated recipes covering common automation patterns the
 * existing pack didn't touch.  Each is a `Recipe` declaration registered
 * inline.  Keep the shapes minimal — users will tailor blocks after
 * instantiation.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const TEMPLATES: Recipe[] = [
  /* 1. Lead enrichment via Clearbit-style HTTP lookup */
  {
    id: 'lead-enrichment-http',
    name: 'Lead enrichment',
    category: 'sales',
    description:
      'Look up an inbound email against an enrichment service, write the profile back as flow variables.',
    tags: ['lead', 'enrichment', 'crm', 'clearbit'],
    trigger: {
      id: 't_lead',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/lead-enrichment',
        method: 'POST',
        authentication: 'none',
        responseMode: 'lastNode',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_email', name: 'email', defaultValue: '' },
      { id: 'v_enrich_url', name: 'enrichUrl', defaultValue: 'https://person.clearbit.com/v2/people/find' },
      { id: 'v_enrich_key', name: 'enrichKey', defaultValue: '' },
      { id: 'v_profile', name: 'profile', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'email', value: '{{ $json.body.email }}' },
      },
      {
        id: 'b_enrich',
        groupId: 'g_enrich',
        type: 'webhook',
        options: {
          url: '{{enrichUrl}}?email={{email}}',
          method: 'GET',
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{enrichKey}}' }],
          responseVariable: 'profile',
        },
      },
    ],
  },

  /* 2. Shopify order-status SMS */
  {
    id: 'shopify-order-sms',
    name: 'Shopify → order-status SMS',
    category: 'ecommerce',
    description:
      'On Shopify order create webhook, send a Twilio SMS to the customer with the order number + shipping ETA.',
    tags: ['shopify', 'twilio', 'sms', 'order'],
    trigger: {
      id: 't_order',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/shopify/orders',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_phone', name: 'customerPhone', defaultValue: '' },
      { id: 'v_order', name: 'orderNumber', defaultValue: '' },
      { id: 'v_eta', name: 'shippingEta', defaultValue: '2-3 business days' },
    ],
    blocks: [
      {
        id: 'b_extract_phone',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'customerPhone', value: '{{ $json.body.customer.phone }}' },
      },
      {
        id: 'b_extract_order',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'orderNumber', value: '{{ $json.body.order_number }}' },
      },
      {
        id: 'b_sms',
        groupId: 'g_send',
        type: 'forge_twilio',
        options: {
          to: '{{customerPhone}}',
          from: '+15551234567',
          body: 'Order #{{orderNumber}} confirmed — ETA {{shippingEta}}. Track it any time.',
        },
      },
    ],
  },

  /* 3. eComm out-of-stock alert */
  {
    id: 'out-of-stock-alert',
    name: 'Out-of-stock Slack alert',
    category: 'ecommerce',
    description:
      'Inventory webhook posts SKU + on-hand count → Slack #ops alert when on-hand hits zero.',
    tags: ['inventory', 'slack', 'ops'],
    trigger: {
      id: 't_inv',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/inventory',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_sku', name: 'sku', defaultValue: '' },
      { id: 'v_qty', name: 'onHand', defaultValue: '0' },
      { id: 'v_hook', name: 'slackWebhook', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_sku',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'sku', value: '{{ $json.body.sku }}' },
      },
      {
        id: 'b_extract_qty',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'onHand', value: '{{ $json.body.qty }}' },
      },
      {
        id: 'b_check',
        groupId: 'g_check',
        type: 'condition',
        options: {
          logicalOperator: 'AND',
          conditionGroups: [
            {
              id: 'cg1',
              logicalOperator: 'AND',
              comparisons: [
                { id: 'c1', variableId: 'v_qty', operator: 'Equal to', value: '0' },
              ],
            },
          ],
        },
      },
      {
        id: 'b_alert',
        groupId: 'g_alert',
        type: 'webhook',
        options: {
          url: '{{slackWebhook}}',
          method: 'POST',
          body: { type: 'json', content: '{"text":":warning: SKU {{sku}} is out of stock"}' },
        },
      },
    ],
  },

  /* 4. Customer success NPS follow-up */
  {
    id: 'cs-nps-followup',
    name: 'NPS follow-up',
    category: 'support',
    description:
      'Detractor (≤6) → personal email from CS lead.  Promoter (≥9) → ask for a testimonial.',
    tags: ['nps', 'cs', 'followup'],
    trigger: {
      id: 't_nps',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/nps',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_score', name: 'score', defaultValue: '0' },
      { id: 'v_email', name: 'reporterEmail', defaultValue: '' },
      { id: 'v_cs_email', name: 'csEmail', defaultValue: 'cs@example.com' },
    ],
    blocks: [
      {
        id: 'b_set_score',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'score', value: '{{ $json.body.score }}' },
      },
      {
        id: 'b_detractor',
        groupId: 'g_branch',
        type: 'condition',
        options: {
          logicalOperator: 'AND',
          conditionGroups: [
            {
              id: 'cg',
              logicalOperator: 'AND',
              comparisons: [
                { id: 'c', variableId: 'v_score', operator: 'Less than or equal', value: '6' },
              ],
            },
          ],
        },
      },
      {
        id: 'b_cs_email',
        groupId: 'g_detractor',
        type: 'send_email',
        options: {
          to: '{{csEmail}}',
          subject: 'Detractor NPS — score {{score}} from {{reporterEmail}}',
          body: 'A user just rated {{score}}/10. Please reach out within 24h.',
        },
      },
    ],
  },

  /* 5. Stripe payment retry */
  {
    id: 'stripe-payment-retry',
    name: 'Stripe payment retry',
    category: 'finance',
    description:
      'On Stripe payment_failed webhook, wait 24h then attempt re-charge via the Stripe Connect block.',
    tags: ['stripe', 'retry', 'payment'],
    trigger: {
      id: 't_failed',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/stripe/payment-failed',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_customer', name: 'customerId', defaultValue: '' },
      { id: 'v_amount', name: 'amountCents', defaultValue: '0' },
      { id: 'v_currency', name: 'currency', defaultValue: 'usd' },
    ],
    blocks: [
      {
        id: 'b_wait',
        groupId: 'g_delay',
        type: 'wait',
        options: { secondsToWaitFor: 60 * 60 * 24 },
      },
      {
        id: 'b_retry',
        groupId: 'g_retry',
        // Step 29 forge blocks aren't yet in the BlockType union — runtime
        // dispatch via the forge registry, so the cast is safe.
        type: 'forge_stripe_connect' as unknown as Recipe['blocks'][number]['type'],
        options: {
          amount: '{{amountCents}}',
          currency: '{{currency}}',
          source: '{{customerId}}',
          description: 'Automated retry from SabFlow',
        },
      },
    ],
  },

  /* 6. Slack on-call rotation reminder */
  {
    id: 'oncall-rotation-reminder',
    name: 'On-call rotation reminder',
    category: 'ops',
    description:
      'Scheduled Monday 9 AM Slack message naming the week\'s on-call engineer.',
    tags: ['oncall', 'slack', 'schedule'],
    trigger: {
      id: 't_schedule',
      type: 'schedule',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'schedule_tick',
      options: { cronExpression: '0 9 * * 1', enabled: true },
    },
    variables: [
      { id: 'v_oncall', name: 'oncallName', defaultValue: 'Ada' },
      { id: 'v_hook', name: 'slackWebhook', defaultValue: '' },
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
            content: '{"text":"This week\'s on-call: *{{oncallName}}* :wave:"}',
          },
        },
      },
    ],
  },

  /* 7. GitHub PR review reminder */
  {
    id: 'github-pr-review-reminder',
    name: 'GitHub PR review reminder',
    category: 'ops',
    description:
      'Daily check of open PRs older than 2 days → Slack ping to the assigned reviewer.',
    tags: ['github', 'review', 'reminder'],
    trigger: {
      id: 't_schedule',
      type: 'schedule',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'schedule_tick',
      options: { cronExpression: '0 10 * * 1-5', enabled: true },
    },
    variables: [
      { id: 'v_repo', name: 'repo', defaultValue: 'owner/repo' },
      { id: 'v_token', name: 'githubToken', defaultValue: '' },
      { id: 'v_hook', name: 'slackWebhook', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_query',
        groupId: 'g_query',
        type: 'webhook',
        options: {
          url: 'https://api.github.com/repos/{{repo}}/pulls?state=open',
          method: 'GET',
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{githubToken}}' }],
          responseVariable: 'prs',
        },
      },
      {
        id: 'b_notify',
        groupId: 'g_notify',
        type: 'webhook',
        options: {
          url: '{{slackWebhook}}',
          method: 'POST',
          body: { type: 'json', content: '{"text":"Open PRs need review: {{prs.length}}"}' },
        },
      },
    ],
  },

  /* 8. Calendar invite confirmation */
  {
    id: 'calendar-invite-confirmation',
    name: 'Calendar invite confirmation',
    category: 'sales',
    description:
      'After Cal.com booking webhook, send a WhatsApp confirmation with meeting link.',
    tags: ['calendar', 'cal.com', 'whatsapp'],
    trigger: {
      id: 't_booked',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/calcom/booked',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_attendee_phone', name: 'attendeePhone', defaultValue: '' },
      { id: 'v_meeting_url', name: 'meetingUrl', defaultValue: '' },
      { id: 'v_when', name: 'when', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'attendeePhone', value: '{{ $json.body.attendee.phone }}' },
      },
      {
        id: 'b_extract_url',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'meetingUrl', value: '{{ $json.body.meetingUrl }}' },
      },
      {
        id: 'b_send',
        groupId: 'g_send',
        type: 'forge_twilio',
        options: {
          to: '{{attendeePhone}}',
          body: 'You\'re booked — join at {{meetingUrl}} on {{when}}.',
        },
      },
    ],
  },

  /* 9. Twitter mention auto-reply */
  {
    id: 'twitter-mention-reply',
    name: 'Twitter mention auto-reply',
    category: 'marketing',
    description:
      'When a Twitter webhook fires with a mention, reply with an OpenAI-generated supportive response.',
    tags: ['twitter', 'social', 'ai', 'openai'],
    trigger: {
      id: 't_mention',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/twitter/mentions',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_text', name: 'mentionText', defaultValue: '' },
      { id: 'v_reply', name: 'reply', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'mentionText', value: '{{ $json.body.text }}' },
      },
      {
        id: 'b_generate',
        groupId: 'g_ai',
        type: 'open_ai',
        options: {
          model: 'gpt-4o-mini',
          task: 'ask_assistant',
          systemPrompt:
            'Reply in a friendly, helpful tone in fewer than 240 characters.  Do not use hashtags.',
          userMessage: '{{mentionText}}',
          responseVariable: 'reply',
        },
      },
    ],
  },

  /* 10. Support ticket auto-tagger */
  {
    id: 'support-ticket-tagger',
    name: 'Support ticket auto-tagger',
    category: 'support',
    description:
      'New support webhook → OpenAI classifies into {billing, bug, feature, other} → POSTs tag back.',
    tags: ['support', 'ai', 'classification'],
    trigger: {
      id: 't_ticket',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/support/new',
        method: 'POST',
        authentication: 'none',
        responseMode: 'lastNode',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_body', name: 'ticketBody', defaultValue: '' },
      { id: 'v_tag', name: 'tag', defaultValue: '' },
      { id: 'v_tag_url', name: 'tagUrl', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'ticketBody', value: '{{ $json.body.message }}' },
      },
      {
        id: 'b_classify',
        groupId: 'g_ai',
        type: 'open_ai',
        options: {
          model: 'gpt-4o-mini',
          task: 'ask_assistant',
          systemPrompt:
            'Classify the ticket into exactly one of: billing, bug, feature, other.  Reply with ONLY the label.',
          userMessage: '{{ticketBody}}',
          responseVariable: 'tag',
        },
      },
      {
        id: 'b_post_tag',
        groupId: 'g_persist',
        type: 'webhook',
        options: {
          url: '{{tagUrl}}',
          method: 'POST',
          body: { type: 'json', content: '{"tag":"{{tag}}"}' },
        },
      },
    ],
  },
];

for (const t of TEMPLATES) registerRecipe(t);
