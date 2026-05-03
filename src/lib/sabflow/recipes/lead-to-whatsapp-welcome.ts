/**
 * Recipe: CRM lead-created → WhatsApp template welcome message.
 *
 * Trigger fires whenever a CRM contact is created.  The flow then sends
 * the configured WhatsApp template (`{{wa_template}}`) to the new lead's
 * phone number, and tags the deal as `welcomed`.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'lead-to-whatsapp-welcome',
  name: 'Lead → WhatsApp Welcome',
  category: 'crm',
  description:
    'When a new lead is created in your CRM, send them a WhatsApp welcome ' +
    'template within seconds and mark the deal as contacted.',
  tags: ['crm', 'whatsapp', 'lead', 'welcome', 'onboarding'],
  trigger: {
    id: 't_lead_created',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'crm_lead_created',
    options: {
      path: '/webhooks/crm/lead-created',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_lead_phone', name: 'lead.phone', defaultValue: '' },
    { id: 'v_lead_name', name: 'lead.name', defaultValue: '' },
    { id: 'v_wa_template', name: 'wa_template', defaultValue: 'welcome_v1' },
  ],
  blocks: [
    // Step 1 — extract phone number into a session variable
    {
      id: 'b_extract',
      groupId: 'g_extract',
      type: 'set_variable',
      options: {
        variableId: 'v_lead_phone',
        valueType: 'custom',
        value: '{{lead.phone}}',
      },
    },
    // Step 2 — send WhatsApp template via Twilio forge
    {
      id: 'b_wa_send',
      groupId: 'g_send',
      type: 'forge_twilio',
      options: {
        action: 'whatsapp_send',
        to: '{{lead.phone}}',
        template: '{{wa_template}}',
        body: 'Hi {{lead.name}} — welcome aboard!',
      },
    },
    // Step 3 — confirmation: log a CRM note via webhook back into the CRM
    {
      id: 'b_crm_note',
      groupId: 'g_note',
      type: 'webhook',
      options: {
        url: '/api/crm/notes',
        method: 'POST',
        body: {
          type: 'json',
          content: JSON.stringify({
            leadId: '{{lead.id}}',
            note: 'WhatsApp welcome sent',
            tag: 'welcomed',
          }),
        },
      },
    },
  ],
};

registerRecipe(recipe);

export default recipe;
