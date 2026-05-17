/**
 * Recipe: Phone number validation + carrier lookup via Twilio Lookup.
 *
 * When a phone number is added to a contact, run Twilio Lookup v2 with the
 * `line_type_intelligence` data package. Save the carrier + line type back
 * to the contact so we can route SMS away from VoIP/landlines that won't
 * deliver, and mark the contact as `sms_eligible` accordingly.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'data-enrich-phone-twilio-lookup',
  name: 'Data: Phone validation (Twilio Lookup)',
  category: 'ops',
  description:
    'On a phone-number change, call Twilio Lookup to fetch carrier + line type, and update the contact with SMS eligibility.',
  tags: ['enrichment', 'twilio', 'phone', 'carrier', 'validation'],
  trigger: {
    id: 't_phone_added',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/contacts/phone-updated',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_contact_id', name: 'contact.id', defaultValue: '' },
    { id: 'v_phone', name: 'contact.phone', defaultValue: '' },
    { id: 'v_line_type', name: 'phone.lineType', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_extract',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'contact.phone', value: '{{ $json.body.phone }}' },
    },
    {
      id: 'b_lookup',
      groupId: 'g_lookup',
      type: 'webhook',
      options: {
        url: 'https://lookups.twilio.com/v2/PhoneNumbers/{{contact.phone}}?Fields=line_type_intelligence',
        method: 'GET',
        headers: [
          {
            id: 'h1',
            key: 'Authorization',
            value: 'Basic {{ base64(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`) }}',
          },
        ],
      },
    },
    {
      id: 'b_capture_type',
      groupId: 'g_capture',
      type: 'set_variable',
      options: { variableName: 'phone.lineType', value: '{{ $json.line_type_intelligence.type }}' },
    },
    {
      id: 'b_patch',
      groupId: 'g_patch',
      type: 'webhook',
      options: {
        url: '/api/crm/contacts/{{contact.id}}',
        method: 'PATCH',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content:
            '{"phoneCarrier":"{{ $json.line_type_intelligence.carrier_name }}","phoneLineType":"{{phone.lineType}}","smsEligible":{{ phone.lineType === "mobile" }},"phoneCountryCode":"{{ $json.country_code }}"}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
