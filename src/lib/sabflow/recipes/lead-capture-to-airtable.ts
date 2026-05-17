/**
 * Recipe: Lead capture → Airtable base.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'lead-capture-to-airtable',
  name: 'Lead capture → Airtable',
  category: 'crm',
  description:
    'Drop fresh leads from a webhook into an Airtable base for easy review and triage.',
  tags: ['lead', 'airtable', 'crm', 'capture'],
  trigger: {
    id: 't_at_lead',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/leads/airtable',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_base', name: 'at.baseId', defaultValue: '' },
    { id: 'v_table', name: 'at.table', defaultValue: 'Leads' },
  ],
  blocks: [
    {
      id: 'b_record',
      groupId: 'g_record',
      type: 'forge_airtable',
      options: {
        action: 'create_record',
        baseId: '{{at.baseId}}',
        tableName: '{{at.table}}',
        fields: '{"Email":"{{ $json.body.email }}","Name":"{{ $json.body.name }}","Source":"webhook"}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
