/**
 * Recipe: Lead-magnet download → HubSpot tag + segment.
 *
 * Triggered when a visitor downloads a gated asset. Drops them into HubSpot
 * with the asset name as a custom property, applies the `lead_magnet_<slug>`
 * tag, and adds them to the matching nurture list.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'marketing-lead-magnet-hubspot',
  name: 'Marketing: Lead magnet → HubSpot segment',
  category: 'marketing',
  description:
    'Capture a lead-magnet download, push the contact to HubSpot with the asset slug as a custom property, and enrol them in the matching nurture list.',
  tags: ['marketing', 'lead-magnet', 'hubspot', 'segmentation', 'crm'],
  trigger: {
    id: 't_download',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/lead-magnet/download',
      method: 'POST',
      authentication: 'none',
      responseMode: 'lastNode',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'lead.email', defaultValue: '' },
    { id: 'v_first', name: 'lead.firstName', defaultValue: '' },
    { id: 'v_last', name: 'lead.lastName', defaultValue: '' },
    { id: 'v_asset', name: 'asset.slug', defaultValue: 'state-of-automation-2026' },
    { id: 'v_list_id', name: 'hubspot.listId', defaultValue: '481' },
  ],
  blocks: [
    {
      id: 'b_set_email',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'lead.email', value: '{{ $json.body.email }}' },
    },
    {
      id: 'b_set_asset',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'asset.slug', value: '{{ $json.body.asset_slug }}' },
    },
    {
      id: 'b_upsert',
      groupId: 'g_upsert',
      type: 'webhook',
      options: {
        url: 'https://api.hubapi.com/crm/v3/objects/contacts',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{HUBSPOT_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"properties":{"email":"{{lead.email}}","firstname":"{{lead.firstName}}","lastname":"{{lead.lastName}}","lead_magnet":"{{asset.slug}}","lifecyclestage":"lead"}}',
        },
      },
    },
    {
      id: 'b_add_to_list',
      groupId: 'g_segment',
      type: 'webhook',
      options: {
        url: 'https://api.hubapi.com/contacts/v1/lists/{{hubspot.listId}}/add',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{HUBSPOT_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: { type: 'json', content: '{"emails":["{{lead.email}}"]}' },
      },
    },
    {
      id: 'b_confirm',
      groupId: 'g_confirm',
      type: 'send_email',
      options: {
        to: '{{lead.email}}',
        subject: 'Your download: {{asset.slug}}',
        body:
          'Thanks {{lead.firstName}} — the download link is in this email. ' +
          'We\'ll send you 3 related reads over the next 10 days.',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
