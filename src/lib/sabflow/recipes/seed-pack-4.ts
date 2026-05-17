/**
 * Step 48 — fourth seed-pack, bringing the template count from 40 → 60.
 *
 * Twenty more production-shaped recipes focused on the cross-platform
 * connective tissue customers ask for first: Slack/Calendly/Stripe/Notion/
 * Airtable/Twilio/PagerDuty-ish glue, plus a few scheduled rituals.
 *
 * Same conventions as seed-pack-3:
 *   - kebab-case stable `id`
 *   - flat `blocks` list grouped by `groupId`
 *   - `{{ $json.body.* }}` for payload fields, `{{ variableName }}` for vars
 *   - forge_* block types that are not in the BlockType union are cast via
 *     `as unknown as Recipe['blocks'][number]['type']`
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const TEMPLATES: Recipe[] = [
  /* 1. Slack DM new lead to AE */
  {
    id: 'slack-dm-new-lead-to-ae',
    name: 'Slack DM new lead to AE',
    category: 'sales',
    description:
      'When a new lead comes in via webhook, DM the on-rotation AE in Slack with the lead snapshot and a "claim" link.',
    tags: ['slack', 'lead', 'ae', 'sales', 'routing'],
    trigger: {
      id: 't_new_lead',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/lead/inbound',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_email', name: 'leadEmail', defaultValue: '' },
      { id: 'v_name', name: 'leadName', defaultValue: '' },
      { id: 'v_company', name: 'leadCompany', defaultValue: '' },
      { id: 'v_ae_slack_id', name: 'aeSlackUserId', defaultValue: '' },
      { id: 'v_claim_url', name: 'claimUrl', defaultValue: 'https://crm.example.com/leads/claim' },
      { id: 'v_slack_token', name: 'slackBotToken', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_email',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'leadEmail', value: '{{ $json.body.lead.email }}' },
      },
      {
        id: 'b_extract_name',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'leadName', value: '{{ $json.body.lead.fullName }}' },
      },
      {
        id: 'b_extract_company',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'leadCompany', value: '{{ $json.body.lead.company }}' },
      },
      {
        id: 'b_open_dm',
        groupId: 'g_dm',
        type: 'webhook',
        options: {
          url: 'https://slack.com/api/conversations.open',
          method: 'POST',
          headers: [
            { id: 'h1', key: 'Authorization', value: 'Bearer {{slackBotToken}}' },
            { id: 'h2', key: 'Content-Type', value: 'application/json' },
          ],
          body: { type: 'json', content: '{"users":"{{aeSlackUserId}}"}' },
          responseVariable: 'dmChannel',
        },
      },
      {
        id: 'b_post_dm',
        groupId: 'g_post',
        type: 'forge_slack' as unknown as Recipe['blocks'][number]['type'],
        options: {
          channel: '{{aeSlackUserId}}',
          text:
            ':zap: *New lead* — *{{leadName}}* @ *{{leadCompany}}* ({{leadEmail}}). Claim it: {{claimUrl}}',
        },
      },
    ],
  },

  /* 2. Stripe subscription upgrade webhook → CRM update */
  {
    id: 'stripe-subscription-upgrade-crm-update',
    name: 'Stripe subscription upgrade → CRM update',
    category: 'finance',
    description:
      'On Stripe subscription.updated, detect a plan upgrade and patch the CRM contact with the new tier + MRR.',
    tags: ['stripe', 'subscription', 'crm', 'finance', 'upgrade'],
    trigger: {
      id: 't_sub_updated',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/stripe/subscription-updated',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_customer_email', name: 'customerEmail', defaultValue: '' },
      { id: 'v_old_plan', name: 'previousPlan', defaultValue: '' },
      { id: 'v_new_plan', name: 'newPlan', defaultValue: '' },
      { id: 'v_mrr', name: 'monthlyAmount', defaultValue: '0' },
      { id: 'v_is_upgrade', name: 'isUpgrade', defaultValue: 'false' },
      { id: 'v_crm_url', name: 'crmUpdateUrl', defaultValue: 'https://crm.example.com/api/contacts/upsert' },
      { id: 'v_crm_token', name: 'crmToken', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_email',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'customerEmail', value: '{{ $json.body.data.object.customer_email }}' },
      },
      {
        id: 'b_extract_old',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'previousPlan', value: '{{ $json.body.data.previous_attributes.plan.nickname }}' },
      },
      {
        id: 'b_extract_new',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'newPlan', value: '{{ $json.body.data.object.plan.nickname }}' },
      },
      {
        id: 'b_extract_mrr',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'monthlyAmount', value: '{{ $json.body.data.object.plan.amount }}' },
      },
      {
        id: 'b_detect_upgrade',
        groupId: 'g_score',
        type: 'script',
        options: {
          name: 'detect-upgrade',
          content:
            "const rank = { free: 0, starter: 1, pro: 2, business: 3, enterprise: 4 };\n" +
            "const a = rank[String(previousPlan).toLowerCase()] ?? 0;\n" +
            "const b = rank[String(newPlan).toLowerCase()] ?? 0;\n" +
            "return { isUpgrade: b > a ? 'true' : 'false' };",
        },
      },
      {
        id: 'b_is_upgrade',
        groupId: 'g_branch',
        type: 'condition',
        options: {
          logicalOperator: 'AND',
          conditionGroups: [
            {
              id: 'cg',
              logicalOperator: 'AND',
              comparisons: [
                { id: 'c', variableId: 'v_is_upgrade', operator: 'Equal to', value: 'true' },
              ],
            },
          ],
        },
      },
      {
        id: 'b_patch_crm',
        groupId: 'g_patch',
        type: 'webhook',
        options: {
          url: '{{crmUpdateUrl}}',
          method: 'POST',
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{crmToken}}' }],
          body: {
            type: 'json',
            content:
              '{"email":"{{customerEmail}}","tier":"{{newPlan}}","mrrCents":{{monthlyAmount}},"lifecycleStage":"customer-upgraded"}',
          },
        },
      },
    ],
  },

  /* 3. Calendly booking → CRM contact creation */
  {
    id: 'calendly-booking-crm-contact',
    name: 'Calendly booking → CRM contact',
    category: 'sales',
    description:
      'On Calendly invitee.created webhook, create or update the CRM contact and stamp the meeting time + meeting type.',
    tags: ['calendly', 'crm', 'contact', 'booking', 'sales'],
    trigger: {
      id: 't_calendly',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/calendly/invitee-created',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_email', name: 'inviteeEmail', defaultValue: '' },
      { id: 'v_name', name: 'inviteeName', defaultValue: '' },
      { id: 'v_event_type', name: 'eventTypeName', defaultValue: '' },
      { id: 'v_start_time', name: 'meetingStart', defaultValue: '' },
      { id: 'v_crm_url', name: 'crmUpsertUrl', defaultValue: 'https://crm.example.com/api/contacts/upsert' },
      { id: 'v_crm_token', name: 'crmToken', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_email',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'inviteeEmail', value: '{{ $json.body.payload.invitee.email }}' },
      },
      {
        id: 'b_extract_name',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'inviteeName', value: '{{ $json.body.payload.invitee.name }}' },
      },
      {
        id: 'b_extract_event',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'eventTypeName', value: '{{ $json.body.payload.event_type.name }}' },
      },
      {
        id: 'b_extract_time',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'meetingStart', value: '{{ $json.body.payload.event.start_time }}' },
      },
      {
        id: 'b_upsert',
        groupId: 'g_upsert',
        type: 'webhook',
        options: {
          url: '{{crmUpsertUrl}}',
          method: 'POST',
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{crmToken}}' }],
          body: {
            type: 'json',
            content:
              '{"email":"{{inviteeEmail}}","fullName":"{{inviteeName}}","source":"calendly","lastMeetingType":"{{eventTypeName}}","lastMeetingAt":"{{meetingStart}}"}',
          },
        },
      },
      {
        id: 'b_confirm',
        groupId: 'g_confirm',
        type: 'send_email',
        options: {
          to: '{{inviteeEmail}}',
          subject: 'Looking forward to our chat',
          body:
            'Hi {{inviteeName}},\n\nThanks for booking — we\'re locked in for {{eventTypeName}} on {{meetingStart}}. Reply to this email if anything changes.',
        },
      },
    ],
  },

  /* 4. Gmail → Notion task creation */
  {
    id: 'gmail-to-notion-task',
    name: 'Gmail starred → Notion task',
    category: 'ops',
    description:
      'When Gmail forwards a starred message via webhook, create a Notion database row capturing sender + subject + body.',
    tags: ['gmail', 'notion', 'task', 'ops', 'inbox-zero'],
    trigger: {
      id: 't_gmail',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/gmail/starred',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_from', name: 'senderEmail', defaultValue: '' },
      { id: 'v_subject', name: 'emailSubject', defaultValue: '' },
      { id: 'v_snippet', name: 'emailSnippet', defaultValue: '' },
      { id: 'v_link', name: 'gmailLink', defaultValue: '' },
      { id: 'v_db', name: 'notionDatabaseId', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_from',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'senderEmail', value: '{{ $json.body.message.from }}' },
      },
      {
        id: 'b_extract_subject',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'emailSubject', value: '{{ $json.body.message.subject }}' },
      },
      {
        id: 'b_extract_snippet',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'emailSnippet', value: '{{ $json.body.message.snippet }}' },
      },
      {
        id: 'b_extract_link',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'gmailLink', value: '{{ $json.body.message.permalink }}' },
      },
      {
        id: 'b_notion',
        groupId: 'g_create',
        type: 'forge_notion',
        options: {
          databaseId: '{{notionDatabaseId}}',
          action: 'create_page',
          title: '{{emailSubject}}',
          properties: {
            From: '{{senderEmail}}',
            Snippet: '{{emailSnippet}}',
            GmailLink: '{{gmailLink}}',
            Status: 'inbox',
          },
        },
      },
    ],
  },

  /* 5. Form submission → Airtable row */
  {
    id: 'form-submission-airtable-row',
    name: 'Form submission → Airtable row',
    category: 'marketing',
    description:
      'A marketing landing-page form posts to the webhook → append a row to the Airtable Leads base with UTM data.',
    tags: ['airtable', 'form', 'marketing', 'lead', 'utm'],
    trigger: {
      id: 't_form',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/landing/form',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_email', name: 'leadEmail', defaultValue: '' },
      { id: 'v_name', name: 'leadName', defaultValue: '' },
      { id: 'v_utm_source', name: 'utmSource', defaultValue: '' },
      { id: 'v_utm_campaign', name: 'utmCampaign', defaultValue: '' },
      { id: 'v_base', name: 'airtableBaseId', defaultValue: '' },
      { id: 'v_table', name: 'airtableTableName', defaultValue: 'Leads' },
    ],
    blocks: [
      {
        id: 'b_extract_email',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'leadEmail', value: '{{ $json.body.email }}' },
      },
      {
        id: 'b_extract_name',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'leadName', value: '{{ $json.body.fullName }}' },
      },
      {
        id: 'b_extract_src',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'utmSource', value: '{{ $json.body.utm.source }}' },
      },
      {
        id: 'b_extract_camp',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'utmCampaign', value: '{{ $json.body.utm.campaign }}' },
      },
      {
        id: 'b_airtable',
        groupId: 'g_create',
        type: 'forge_airtable',
        options: {
          baseId: '{{airtableBaseId}}',
          tableName: '{{airtableTableName}}',
          action: 'create_record',
          fields: {
            Email: '{{leadEmail}}',
            Name: '{{leadName}}',
            Source: '{{utmSource}}',
            Campaign: '{{utmCampaign}}',
            Status: 'new',
          },
        },
      },
    ],
  },

  /* 6. WhatsApp inbound → CRM ticket */
  {
    id: 'whatsapp-inbound-crm-ticket',
    name: 'WhatsApp inbound → CRM ticket',
    category: 'whatsapp',
    description:
      'When a WhatsApp message arrives via webhook, open a CRM support ticket with the conversation + sender details.',
    tags: ['whatsapp', 'crm', 'ticket', 'support', 'inbound'],
    trigger: {
      id: 't_wa',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'whatsapp_message_received',
      options: {
        path: '/webhooks/whatsapp/inbound',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_phone', name: 'fromPhone', defaultValue: '' },
      { id: 'v_name', name: 'fromName', defaultValue: '' },
      { id: 'v_message', name: 'messageBody', defaultValue: '' },
      { id: 'v_wa_id', name: 'whatsappId', defaultValue: '' },
      { id: 'v_crm_url', name: 'ticketUrl', defaultValue: 'https://crm.example.com/api/tickets' },
      { id: 'v_crm_token', name: 'crmToken', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_phone',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'fromPhone', value: '{{ $json.body.from.phone }}' },
      },
      {
        id: 'b_extract_name',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'fromName', value: '{{ $json.body.from.name }}' },
      },
      {
        id: 'b_extract_msg',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'messageBody', value: '{{ $json.body.message.text }}' },
      },
      {
        id: 'b_extract_id',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'whatsappId', value: '{{ $json.body.message.id }}' },
      },
      {
        id: 'b_open_ticket',
        groupId: 'g_open',
        type: 'webhook',
        options: {
          url: '{{ticketUrl}}',
          method: 'POST',
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{crmToken}}' }],
          body: {
            type: 'json',
            content:
              '{"channel":"whatsapp","contact":{"phone":"{{fromPhone}}","name":"{{fromName}}"},"subject":"WhatsApp message","body":"{{messageBody}}","externalId":"{{whatsappId}}"}',
          },
        },
      },
    ],
  },

  /* 7. Daily sales summary digest at 6pm */
  {
    id: 'daily-sales-summary-6pm',
    name: 'Daily sales summary at 6pm',
    category: 'sales',
    description:
      'Every weekday at 18:00, fetch the day\'s pipeline movement and email a digest to the sales leadership list.',
    tags: ['sales', 'digest', 'schedule', 'pipeline', 'reporting'],
    trigger: {
      id: 't_sales_digest',
      type: 'schedule',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'schedule_tick',
      options: { cronExpression: '0 18 * * 1-5', enabled: true },
    },
    variables: [
      { id: 'v_url', name: 'salesSummaryUrl', defaultValue: 'https://api.example.com/sales/daily' },
      { id: 'v_token', name: 'apiToken', defaultValue: '' },
      { id: 'v_summary', name: 'summary', defaultValue: '' },
      { id: 'v_recipients', name: 'recipients', defaultValue: 'sales-lead@example.com' },
    ],
    blocks: [
      {
        id: 'b_fetch',
        groupId: 'g_fetch',
        type: 'webhook',
        options: {
          url: '{{salesSummaryUrl}}',
          method: 'GET',
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{apiToken}}' }],
          responseVariable: 'summary',
        },
      },
      {
        id: 'b_email',
        groupId: 'g_email',
        type: 'send_email',
        options: {
          to: '{{recipients}}',
          subject: 'EOD sales digest',
          body:
            'Today\'s pipeline:\n' +
            'New deals: {{summary.newDeals}}\n' +
            'Closed-won: {{summary.closedWon}} ({{summary.closedWonAmount}})\n' +
            'Stage moves: {{summary.stageMoves}}\n' +
            'Stuck > 14d: {{summary.stalled}}',
        },
      },
    ],
  },

  /* 8. Twitter mention → support ticket */
  {
    id: 'twitter-mention-support-ticket',
    name: 'Twitter mention → support ticket',
    category: 'support',
    description:
      'When the brand is @-mentioned on Twitter, classify the sentiment and open a support ticket if it looks like a complaint.',
    tags: ['twitter', 'support', 'ticket', 'social', 'sentiment'],
    trigger: {
      id: 't_tweet',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/twitter/mention',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_handle', name: 'handle', defaultValue: '' },
      { id: 'v_tweet', name: 'tweetText', defaultValue: '' },
      { id: 'v_tweet_url', name: 'tweetUrl', defaultValue: '' },
      { id: 'v_sentiment', name: 'sentiment', defaultValue: '' },
      { id: 'v_ticket_url', name: 'ticketUrl', defaultValue: 'https://crm.example.com/api/tickets' },
      { id: 'v_crm_token', name: 'crmToken', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_handle',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'handle', value: '{{ $json.body.user.username }}' },
      },
      {
        id: 'b_extract_text',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'tweetText', value: '{{ $json.body.tweet.text }}' },
      },
      {
        id: 'b_extract_url',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'tweetUrl', value: '{{ $json.body.tweet.url }}' },
      },
      {
        id: 'b_classify',
        groupId: 'g_ai',
        type: 'open_ai',
        options: {
          model: 'gpt-4o-mini',
          task: 'ask_assistant',
          systemPrompt:
            'Classify this tweet about our brand into exactly one label: positive, neutral, complaint. Reply with only the label.',
          userMessage: '{{tweetText}}',
          responseVariable: 'sentiment',
        },
      },
      {
        id: 'b_is_complaint',
        groupId: 'g_branch',
        type: 'condition',
        options: {
          logicalOperator: 'AND',
          conditionGroups: [
            {
              id: 'cg',
              logicalOperator: 'AND',
              comparisons: [
                { id: 'c', variableId: 'v_sentiment', operator: 'Equal to', value: 'complaint' },
              ],
            },
          ],
        },
      },
      {
        id: 'b_open_ticket',
        groupId: 'g_ticket',
        type: 'webhook',
        options: {
          url: '{{ticketUrl}}',
          method: 'POST',
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{crmToken}}' }],
          body: {
            type: 'json',
            content:
              '{"channel":"twitter","subject":"Twitter complaint from @{{handle}}","body":"{{tweetText}}\\n\\n{{tweetUrl}}","priority":"high"}',
          },
        },
      },
    ],
  },

  /* 9. Github issue closed → release notes draft */
  {
    id: 'github-issue-closed-release-notes',
    name: 'Github issue closed → release notes draft',
    category: 'ops',
    description:
      'When a Github issue closes, append a one-liner to a "release notes" Notion page so the next changelog drafts itself.',
    tags: ['github', 'release-notes', 'changelog', 'ops', 'notion'],
    trigger: {
      id: 't_issue_closed',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/github/issue-closed',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_title', name: 'issueTitle', defaultValue: '' },
      { id: 'v_number', name: 'issueNumber', defaultValue: '' },
      { id: 'v_url', name: 'issueUrl', defaultValue: '' },
      { id: 'v_labels', name: 'issueLabels', defaultValue: '' },
      { id: 'v_summary', name: 'releaseLine', defaultValue: '' },
      { id: 'v_page_id', name: 'releaseNotesPageId', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_title',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'issueTitle', value: '{{ $json.body.issue.title }}' },
      },
      {
        id: 'b_extract_number',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'issueNumber', value: '{{ $json.body.issue.number }}' },
      },
      {
        id: 'b_extract_url',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'issueUrl', value: '{{ $json.body.issue.html_url }}' },
      },
      {
        id: 'b_extract_labels',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'issueLabels', value: '{{ $json.body.issue.labels }}' },
      },
      {
        id: 'b_draft',
        groupId: 'g_ai',
        type: 'open_ai',
        options: {
          model: 'gpt-4o-mini',
          task: 'ask_assistant',
          systemPrompt:
            'Rewrite the following closed Github issue title into a single-line user-facing release note. Use imperative voice, no period.',
          userMessage: '#{{issueNumber}} {{issueTitle}} ({{issueLabels}})',
          responseVariable: 'releaseLine',
        },
      },
      {
        id: 'b_append',
        groupId: 'g_append',
        type: 'forge_notion',
        options: {
          pageId: '{{releaseNotesPageId}}',
          action: 'append_block',
          block: {
            type: 'bulleted_list_item',
            text: '{{releaseLine}} ({{issueUrl}})',
          },
        },
      },
    ],
  },

  /* 10. Shopify low-stock → reorder webhook */
  {
    id: 'shopify-low-stock-reorder',
    name: 'Shopify low-stock → reorder webhook',
    category: 'ecommerce',
    description:
      'On Shopify inventory_levels/update, when on-hand drops below the reorder point, POST to the supplier API to reorder.',
    tags: ['shopify', 'inventory', 'reorder', 'ecommerce', 'supplier'],
    trigger: {
      id: 't_shopify_inv',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/shopify/inventory-levels',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_sku', name: 'sku', defaultValue: '' },
      { id: 'v_on_hand', name: 'onHand', defaultValue: '0' },
      { id: 'v_reorder_point', name: 'reorderPoint', defaultValue: '10' },
      { id: 'v_reorder_qty', name: 'reorderQty', defaultValue: '50' },
      { id: 'v_supplier_url', name: 'supplierUrl', defaultValue: '' },
      { id: 'v_supplier_token', name: 'supplierToken', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_sku',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'sku', value: '{{ $json.body.inventory_item.sku }}' },
      },
      {
        id: 'b_extract_qty',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'onHand', value: '{{ $json.body.available }}' },
      },
      {
        id: 'b_low',
        groupId: 'g_branch',
        type: 'condition',
        options: {
          logicalOperator: 'AND',
          conditionGroups: [
            {
              id: 'cg',
              logicalOperator: 'AND',
              comparisons: [
                { id: 'c', variableId: 'v_on_hand', operator: 'Less than or equal', value: '{{reorderPoint}}' },
              ],
            },
          ],
        },
      },
      {
        id: 'b_reorder',
        groupId: 'g_reorder',
        type: 'webhook',
        options: {
          url: '{{supplierUrl}}',
          method: 'POST',
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{supplierToken}}' }],
          body: {
            type: 'json',
            content: '{"sku":"{{sku}}","quantity":{{reorderQty}},"reason":"auto-reorder"}',
          },
        },
      },
    ],
  },

  /* 11. AdWords budget exceeded → Slack alert */
  {
    id: 'adwords-budget-exceeded-slack',
    name: 'AdWords budget exceeded → Slack alert',
    category: 'ads',
    description:
      'When the Google Ads daily-budget alert fires, post a formatted alert to Slack #ads with overspend percentage.',
    tags: ['adwords', 'google-ads', 'budget', 'slack', 'alert'],
    trigger: {
      id: 't_budget',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/adwords/budget-exceeded',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_campaign', name: 'campaignName', defaultValue: '' },
      { id: 'v_budget', name: 'dailyBudget', defaultValue: '0' },
      { id: 'v_spent', name: 'spentToday', defaultValue: '0' },
      { id: 'v_overspend_pct', name: 'overspendPct', defaultValue: '0' },
      { id: 'v_slack', name: 'slackWebhook', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_campaign',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'campaignName', value: '{{ $json.body.campaign.name }}' },
      },
      {
        id: 'b_extract_budget',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'dailyBudget', value: '{{ $json.body.campaign.dailyBudget }}' },
      },
      {
        id: 'b_extract_spent',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'spentToday', value: '{{ $json.body.campaign.spentToday }}' },
      },
      {
        id: 'b_calc',
        groupId: 'g_calc',
        type: 'script',
        options: {
          name: 'overspend-pct',
          content:
            "const b = Number(dailyBudget) || 1;\n" +
            "const s = Number(spentToday) || 0;\n" +
            "return { overspendPct: Math.round(((s - b) / b) * 100) };",
        },
      },
      {
        id: 'b_alert',
        groupId: 'g_alert',
        type: 'webhook',
        options: {
          url: '{{slackWebhook}}',
          method: 'POST',
          body: {
            type: 'json',
            content:
              '{"text":":fire: AdWords budget exceeded — *{{campaignName}}* spent {{spentToday}} vs budget {{dailyBudget}} (+{{overspendPct}}%)"}',
          },
        },
      },
    ],
  },

  /* 12. LinkedIn connection → CRM contact */
  {
    id: 'linkedin-connection-crm-contact',
    name: 'LinkedIn connection → CRM contact',
    category: 'sales',
    description:
      'When a new LinkedIn connection is accepted via webhook, create or update the CRM contact with role + company.',
    tags: ['linkedin', 'crm', 'contact', 'sales', 'network'],
    trigger: {
      id: 't_li',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/linkedin/connection-accepted',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_name', name: 'connectionName', defaultValue: '' },
      { id: 'v_headline', name: 'headline', defaultValue: '' },
      { id: 'v_company', name: 'company', defaultValue: '' },
      { id: 'v_profile_url', name: 'profileUrl', defaultValue: '' },
      { id: 'v_crm_url', name: 'crmUrl', defaultValue: 'https://crm.example.com/api/contacts/upsert' },
      { id: 'v_crm_token', name: 'crmToken', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_name',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'connectionName', value: '{{ $json.body.profile.fullName }}' },
      },
      {
        id: 'b_extract_headline',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'headline', value: '{{ $json.body.profile.headline }}' },
      },
      {
        id: 'b_extract_company',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'company', value: '{{ $json.body.profile.currentCompany }}' },
      },
      {
        id: 'b_extract_url',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'profileUrl', value: '{{ $json.body.profile.url }}' },
      },
      {
        id: 'b_upsert',
        groupId: 'g_upsert',
        type: 'webhook',
        options: {
          url: '{{crmUrl}}',
          method: 'POST',
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{crmToken}}' }],
          body: {
            type: 'json',
            content:
              '{"fullName":"{{connectionName}}","headline":"{{headline}}","company":"{{company}}","linkedinUrl":"{{profileUrl}}","source":"linkedin"}',
          },
        },
      },
    ],
  },

  /* 13. New employee → IT onboarding tickets */
  {
    id: 'new-employee-it-onboarding-tickets',
    name: 'New employee → IT onboarding tickets',
    category: 'onboarding',
    description:
      'On HR hired event, fan out IT tickets: laptop, accounts, badge, and security training, each via the IT ticket API.',
    tags: ['hr', 'it', 'onboarding', 'tickets', 'employee'],
    trigger: {
      id: 't_hired',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/hr/hired',
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
      { id: 'v_start_date', name: 'startDate', defaultValue: '' },
      { id: 'v_it_url', name: 'itTicketUrl', defaultValue: 'https://it.example.com/api/tickets' },
      { id: 'v_it_token', name: 'itToken', defaultValue: '' },
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
        id: 'b_extract_start',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'startDate', value: '{{ $json.body.employee.startDate }}' },
      },
      {
        id: 'b_laptop',
        groupId: 'g_laptop',
        type: 'webhook',
        options: {
          url: '{{itTicketUrl}}',
          method: 'POST',
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{itToken}}' }],
          body: {
            type: 'json',
            content:
              '{"queue":"laptop-provisioning","title":"Laptop for {{employeeName}}","dueDate":"{{startDate}}","assignee_email":"{{employeeEmail}}","role":"{{role}}"}',
          },
        },
      },
      {
        id: 'b_accounts',
        groupId: 'g_accounts',
        type: 'webhook',
        options: {
          url: '{{itTicketUrl}}',
          method: 'POST',
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{itToken}}' }],
          body: {
            type: 'json',
            content:
              '{"queue":"account-provisioning","title":"Provision accounts for {{employeeName}} ({{role}})","dueDate":"{{startDate}}","email":"{{employeeEmail}}"}',
          },
        },
      },
      {
        id: 'b_badge',
        groupId: 'g_badge',
        type: 'webhook',
        options: {
          url: '{{itTicketUrl}}',
          method: 'POST',
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{itToken}}' }],
          body: {
            type: 'json',
            content:
              '{"queue":"physical-access","title":"Badge for {{employeeName}}","dueDate":"{{startDate}}"}',
          },
        },
      },
      {
        id: 'b_training',
        groupId: 'g_training',
        type: 'webhook',
        options: {
          url: '{{itTicketUrl}}',
          method: 'POST',
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{itToken}}' }],
          body: {
            type: 'json',
            content:
              '{"queue":"security-training","title":"Enrol {{employeeName}} in security training","dueDate":"{{startDate}}","email":"{{employeeEmail}}"}',
          },
        },
      },
    ],
  },

  /* 14. Exit interview → analytics + Slack */
  {
    id: 'exit-interview-analytics-slack',
    name: 'Exit interview → analytics + Slack',
    category: 'onboarding',
    description:
      'When an exit-interview form is submitted, log the response to the analytics warehouse and post a redacted note to Slack #people-ops.',
    tags: ['hr', 'offboarding', 'exit-interview', 'analytics', 'slack'],
    trigger: {
      id: 't_exit',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/hr/exit-interview',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_employee_id', name: 'employeeId', defaultValue: '' },
      { id: 'v_tenure', name: 'tenureMonths', defaultValue: '0' },
      { id: 'v_team', name: 'team', defaultValue: '' },
      { id: 'v_primary', name: 'primaryReason', defaultValue: '' },
      { id: 'v_nps', name: 'companyNps', defaultValue: '' },
      { id: 'v_warehouse', name: 'warehouseUrl', defaultValue: 'https://analytics.example.com/api/events' },
      { id: 'v_warehouse_token', name: 'warehouseToken', defaultValue: '' },
      { id: 'v_slack', name: 'slackWebhook', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_id',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'employeeId', value: '{{ $json.body.employeeId }}' },
      },
      {
        id: 'b_extract_tenure',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'tenureMonths', value: '{{ $json.body.tenureMonths }}' },
      },
      {
        id: 'b_extract_team',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'team', value: '{{ $json.body.team }}' },
      },
      {
        id: 'b_extract_reason',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'primaryReason', value: '{{ $json.body.primaryReason }}' },
      },
      {
        id: 'b_extract_nps',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'companyNps', value: '{{ $json.body.companyNps }}' },
      },
      {
        id: 'b_warehouse',
        groupId: 'g_warehouse',
        type: 'webhook',
        options: {
          url: '{{warehouseUrl}}',
          method: 'POST',
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{warehouseToken}}' }],
          body: {
            type: 'json',
            content:
              '{"event":"exit_interview","employeeId":"{{employeeId}}","tenureMonths":{{tenureMonths}},"team":"{{team}}","reason":"{{primaryReason}}","nps":"{{companyNps}}"}',
          },
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
              '{"text":":wave: Exit interview logged — team *{{team}}*, tenure {{tenureMonths}}mo, primary reason: _{{primaryReason}}_, NPS {{companyNps}}."}',
          },
        },
      },
    ],
  },

  /* 15. Invoice paid → thank-you email + Slack #revenue */
  {
    id: 'invoice-paid-thanks-and-revenue-slack',
    name: 'Invoice paid → thank-you email + #revenue ping',
    category: 'finance',
    description:
      'On invoice.paid, send the customer a thank-you email and ping Slack #revenue with the amount + customer.',
    tags: ['invoice', 'finance', 'slack', 'thank-you', 'revenue'],
    trigger: {
      id: 't_invoice_paid',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/invoice/paid',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_email', name: 'customerEmail', defaultValue: '' },
      { id: 'v_name', name: 'customerName', defaultValue: 'there' },
      { id: 'v_invoice_id', name: 'invoiceId', defaultValue: '' },
      { id: 'v_amount', name: 'amountFormatted', defaultValue: '' },
      { id: 'v_slack', name: 'revenueSlackWebhook', defaultValue: '' },
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
        id: 'b_extract_invoice',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'invoiceId', value: '{{ $json.body.invoice.id }}' },
      },
      {
        id: 'b_extract_amount',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'amountFormatted', value: '{{ $json.body.invoice.amountFormatted }}' },
      },
      {
        id: 'b_email',
        groupId: 'g_email',
        type: 'send_email',
        options: {
          to: '{{customerEmail}}',
          subject: 'Thanks for your payment — invoice {{invoiceId}}',
          body:
            'Hi {{customerName}},\n\nWe received your payment of {{amountFormatted}} for invoice {{invoiceId}}. ' +
            'A receipt is attached to this email. Thanks for your business!',
        },
      },
      {
        id: 'b_slack',
        groupId: 'g_slack',
        type: 'webhook',
        options: {
          url: '{{revenueSlackWebhook}}',
          method: 'POST',
          body: {
            type: 'json',
            content:
              '{"text":":moneybag: *{{amountFormatted}}* paid by {{customerName}} ({{customerEmail}}) — invoice {{invoiceId}}"}',
          },
        },
      },
    ],
  },

  /* 16. Customer support ticket resolved → NPS survey */
  {
    id: 'ticket-resolved-nps-survey',
    name: 'Support ticket resolved → NPS survey',
    category: 'support',
    description:
      'When a support ticket flips to resolved, wait 24h, then email the requester a one-click NPS survey link.',
    tags: ['support', 'nps', 'survey', 'csat', 'ticket'],
    trigger: {
      id: 't_resolved',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/ticket/resolved',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_email', name: 'requesterEmail', defaultValue: '' },
      { id: 'v_name', name: 'requesterName', defaultValue: 'there' },
      { id: 'v_ticket_id', name: 'ticketId', defaultValue: '' },
      { id: 'v_survey_url', name: 'surveyBaseUrl', defaultValue: 'https://survey.example.com/nps' },
    ],
    blocks: [
      {
        id: 'b_extract_email',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'requesterEmail', value: '{{ $json.body.ticket.requester.email }}' },
      },
      {
        id: 'b_extract_name',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'requesterName', value: '{{ $json.body.ticket.requester.firstName }}' },
      },
      {
        id: 'b_extract_ticket',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'ticketId', value: '{{ $json.body.ticket.id }}' },
      },
      {
        id: 'b_wait',
        groupId: 'g_wait',
        type: 'wait',
        options: { secondsToWaitFor: 60 * 60 * 24 },
      },
      {
        id: 'b_email',
        groupId: 'g_email',
        type: 'send_email',
        options: {
          to: '{{requesterEmail}}',
          subject: 'How did we do on ticket {{ticketId}}?',
          body:
            'Hi {{requesterName}},\n\nWe wrapped up your ticket {{ticketId}} yesterday. ' +
            'How likely are you to recommend us? It takes one click: {{surveyBaseUrl}}?ticket={{ticketId}}',
        },
      },
    ],
  },

  /* 17. New product review → social repost */
  {
    id: 'product-review-social-repost',
    name: 'New product review → social repost',
    category: 'marketing',
    description:
      'On a new 5-star product review webhook, post a celebratory tweet/Buffer card via outbound webhook.',
    tags: ['reviews', 'social', 'marketing', 'repost', 'ugc'],
    trigger: {
      id: 't_review',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/reviews/new',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_rating', name: 'rating', defaultValue: '0' },
      { id: 'v_author', name: 'author', defaultValue: '' },
      { id: 'v_product', name: 'product', defaultValue: '' },
      { id: 'v_body', name: 'reviewBody', defaultValue: '' },
      { id: 'v_buffer_url', name: 'bufferWebhook', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_rating',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'rating', value: '{{ $json.body.review.rating }}' },
      },
      {
        id: 'b_extract_author',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'author', value: '{{ $json.body.review.author }}' },
      },
      {
        id: 'b_extract_product',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'product', value: '{{ $json.body.review.product }}' },
      },
      {
        id: 'b_extract_body',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'reviewBody', value: '{{ $json.body.review.body }}' },
      },
      {
        id: 'b_five_star',
        groupId: 'g_branch',
        type: 'condition',
        options: {
          logicalOperator: 'AND',
          conditionGroups: [
            {
              id: 'cg',
              logicalOperator: 'AND',
              comparisons: [
                { id: 'c', variableId: 'v_rating', operator: 'Greater than or equal', value: '5' },
              ],
            },
          ],
        },
      },
      {
        id: 'b_repost',
        groupId: 'g_repost',
        type: 'webhook',
        options: {
          url: '{{bufferWebhook}}',
          method: 'POST',
          body: {
            type: 'json',
            content:
              '{"text":":star: {{author}} on *{{product}}*: \\"{{reviewBody}}\\" Thanks for the love!","channels":["twitter","linkedin"]}',
          },
        },
      },
    ],
  },

  /* 18. Recurring weekly retro reminder */
  {
    id: 'weekly-retro-reminder',
    name: 'Weekly retro reminder',
    category: 'ops',
    description:
      'Every Friday at 15:30, post a Slack reminder linking the team retro template so engineers can pre-fill.',
    tags: ['retro', 'ops', 'schedule', 'slack', 'ritual'],
    trigger: {
      id: 't_retro',
      type: 'schedule',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'schedule_tick',
      options: { cronExpression: '30 15 * * 5', enabled: true },
    },
    variables: [
      { id: 'v_slack', name: 'slackWebhook', defaultValue: '' },
      { id: 'v_channel', name: 'channel', defaultValue: '#team-retro' },
      { id: 'v_doc_url', name: 'retroDocUrl', defaultValue: 'https://docs.example.com/retro/this-week' },
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
              '{"channel":"{{channel}}","text":":mirror_ball: *Retro time* — pre-fill before 16:30:\\n- What went well?\\n- What didn\'t?\\n- What will we change?\\nDoc: {{retroDocUrl}}"}',
          },
        },
      },
    ],
  },

  /* 19. Server alert webhook → on-call SMS via Twilio */
  {
    id: 'server-alert-oncall-twilio-sms',
    name: 'Server alert → on-call SMS via Twilio',
    category: 'ops',
    description:
      'On a critical server alert webhook (Prometheus/Datadog-shaped), SMS the on-call engineer via Twilio.',
    tags: ['monitoring', 'alert', 'twilio', 'sms', 'on-call', 'ops'],
    trigger: {
      id: 't_alert',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/monitoring/alert',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_severity', name: 'severity', defaultValue: '' },
      { id: 'v_summary', name: 'alertSummary', defaultValue: '' },
      { id: 'v_service', name: 'service', defaultValue: '' },
      { id: 'v_runbook', name: 'runbookUrl', defaultValue: '' },
      { id: 'v_oncall_phone', name: 'oncallPhone', defaultValue: '' },
      { id: 'v_twilio_from', name: 'twilioFrom', defaultValue: '+15550001111' },
    ],
    blocks: [
      {
        id: 'b_extract_severity',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'severity', value: '{{ $json.body.alert.severity }}' },
      },
      {
        id: 'b_extract_summary',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'alertSummary', value: '{{ $json.body.alert.summary }}' },
      },
      {
        id: 'b_extract_service',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'service', value: '{{ $json.body.alert.service }}' },
      },
      {
        id: 'b_extract_runbook',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'runbookUrl', value: '{{ $json.body.alert.runbookUrl }}' },
      },
      {
        id: 'b_is_critical',
        groupId: 'g_branch',
        type: 'condition',
        options: {
          logicalOperator: 'AND',
          conditionGroups: [
            {
              id: 'cg',
              logicalOperator: 'AND',
              comparisons: [
                { id: 'c', variableId: 'v_severity', operator: 'Equal to', value: 'critical' },
              ],
            },
          ],
        },
      },
      {
        id: 'b_sms',
        groupId: 'g_sms',
        type: 'forge_twilio',
        options: {
          to: '{{oncallPhone}}',
          from: '{{twilioFrom}}',
          body: '[{{severity}}] {{service}}: {{alertSummary}} — runbook {{runbookUrl}}',
        },
      },
    ],
  },

  /* 20. Calendar event 1h before → meeting brief email */
  {
    id: 'calendar-1h-before-meeting-brief',
    name: 'Calendar event 1h before → meeting brief',
    category: 'sales',
    description:
      'When a calendar event is 1h away (via webhook), generate an AI meeting brief about the external attendees and email it to the host.',
    tags: ['calendar', 'meeting-brief', 'sales', 'ai', 'preparation'],
    trigger: {
      id: 't_t_minus_60',
      type: 'webhook',
      graphCoordinates: { x: 0, y: 0 },
      appEvent: 'webhook_received',
      options: {
        path: '/webhooks/calendar/t-minus-60',
        method: 'POST',
        authentication: 'none',
        responseMode: 'immediately',
        enabled: true,
      },
    },
    variables: [
      { id: 'v_host_email', name: 'hostEmail', defaultValue: '' },
      { id: 'v_title', name: 'eventTitle', defaultValue: '' },
      { id: 'v_attendees', name: 'externalAttendees', defaultValue: '' },
      { id: 'v_start', name: 'eventStart', defaultValue: '' },
      { id: 'v_brief', name: 'meetingBrief', defaultValue: '' },
    ],
    blocks: [
      {
        id: 'b_extract_host',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'hostEmail', value: '{{ $json.body.event.host.email }}' },
      },
      {
        id: 'b_extract_title',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'eventTitle', value: '{{ $json.body.event.title }}' },
      },
      {
        id: 'b_extract_attendees',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'externalAttendees', value: '{{ $json.body.event.externalAttendees }}' },
      },
      {
        id: 'b_extract_start',
        groupId: 'g_setup',
        type: 'set_variable',
        options: { variableName: 'eventStart', value: '{{ $json.body.event.start }}' },
      },
      {
        id: 'b_brief',
        groupId: 'g_ai',
        type: 'anthropic',
        options: {
          model: 'claude-3-5-sonnet-latest',
          task: 'ask_assistant',
          systemPrompt:
            'You write a short pre-meeting brief. Given a meeting title and a JSON-stringified list of external attendees, produce 5 bullet points: 1) the likely meeting goal, 2) what each attendee likely cares about, 3) two smart questions the host should ask, 4) one risk to manage, 5) a suggested next-step. Plain text only.',
          userMessage: 'Title: {{eventTitle}}\nStart: {{eventStart}}\nAttendees: {{externalAttendees}}',
          responseVariable: 'meetingBrief',
        },
      },
      {
        id: 'b_email',
        groupId: 'g_email',
        type: 'send_email',
        options: {
          to: '{{hostEmail}}',
          subject: 'Prep for {{eventTitle}} (starts {{eventStart}})',
          body:
            'Your meeting brief — generated 60 min before {{eventTitle}}:\n\n{{meetingBrief}}\n\nGood luck!',
        },
      },
    ],
  },
];

for (const t of TEMPLATES) registerRecipe(t);
