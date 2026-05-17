/**
 * Recipe: Influencer outreach pipeline — Notion → Gmail → CRM.
 *
 * A Notion database tracks shortlisted creators. When a row is flipped to
 * `status = "approved"` via a Notion-button webhook, we send a personalised
 * outreach email and create a CRM deal in the "Partnerships" pipeline.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'marketing-influencer-outreach',
  name: 'Marketing: Influencer outreach pipeline',
  category: 'marketing',
  description:
    'On a Notion row approval, send a personalised Gmail outreach and create a Partnerships deal in the CRM.',
  tags: ['marketing', 'influencer', 'notion', 'gmail', 'crm'],
  trigger: {
    id: 't_approved',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/notion/influencer-approved',
      method: 'POST',
      authentication: 'none',
      responseMode: 'lastNode',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_creator_name', name: 'creator.name', defaultValue: '' },
    { id: 'v_creator_email', name: 'creator.email', defaultValue: '' },
    { id: 'v_creator_handle', name: 'creator.handle', defaultValue: '' },
    { id: 'v_creator_niche', name: 'creator.niche', defaultValue: 'lifestyle' },
    { id: 'v_pipeline_id', name: 'crm.pipelineId', defaultValue: 'partnerships' },
  ],
  blocks: [
    {
      id: 'b_extract_name',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'creator.name', value: '{{ $json.body.properties.Name.title[0].plain_text }}' },
    },
    {
      id: 'b_extract_email',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'creator.email', value: '{{ $json.body.properties.Email.email }}' },
    },
    {
      id: 'b_personalise',
      groupId: 'g_ai',
      type: 'open_ai',
      options: {
        model: 'gpt-4o-mini',
        task: 'ask_assistant',
        systemPrompt:
          'You write warm, specific outreach emails to creators. Mention their niche by name. Sign off as "Maya from SabNode". Keep it under 120 words.',
        userMessage:
          'Write an outreach email to {{creator.name}} ({{creator.handle}}, niche: {{creator.niche}}). Pitch a paid partnership for our automation product.',
        temperature: 0.6,
        maxTokens: 350,
        responseVariable: 'outreach_body',
        messagesFormat: 'last',
      },
    },
    {
      id: 'b_send',
      groupId: 'g_send',
      type: 'webhook',
      options: {
        url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{GMAIL_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"raw":"{{ base64(`From: maya@sabnode.com\\nTo: {{creator.email}}\\nSubject: Partnership idea for {{creator.handle}}\\n\\n{{outreach_body}}`) }}"}',
        },
      },
    },
    {
      id: 'b_create_deal',
      groupId: 'g_crm',
      type: 'webhook',
      options: {
        url: '/api/crm/deals',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content:
            '{"name":"Partnership: {{creator.name}}","pipelineId":"{{crm.pipelineId}}","stage":"outreach_sent","contact":{"name":"{{creator.name}}","email":"{{creator.email}}"},"metadata":{"handle":"{{creator.handle}}","niche":"{{creator.niche}}"}}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
