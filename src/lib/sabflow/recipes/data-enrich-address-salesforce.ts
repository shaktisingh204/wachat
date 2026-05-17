/**
 * Recipe: Address normalisation via USPS → Salesforce account.
 *
 * Salesforce fires a workflow webhook when an Account's billing address
 * changes. We normalise the address through USPS's Web Tools API (the de-
 * facto standard for US street normalisation) and patch the cleaned street
 * back onto the Account record.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'data-enrich-address-salesforce',
  name: 'Data: USPS address normalisation → Salesforce',
  category: 'crm',
  description:
    'On a Salesforce account billing-address change, normalise the address via USPS Web Tools and write the cleaned values back.',
  tags: ['enrichment', 'usps', 'salesforce', 'address', 'normalisation'],
  trigger: {
    id: 't_sf_addr',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/salesforce/account-address-changed',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_account_id', name: 'account.id', defaultValue: '' },
    { id: 'v_street', name: 'address.street', defaultValue: '' },
    { id: 'v_city', name: 'address.city', defaultValue: '' },
    { id: 'v_state', name: 'address.state', defaultValue: '' },
    { id: 'v_zip', name: 'address.zip', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_set_street',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'address.street', value: '{{ $json.body.BillingStreet }}' },
    },
    {
      id: 'b_set_city',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'address.city', value: '{{ $json.body.BillingCity }}' },
    },
    {
      id: 'b_set_state',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'address.state', value: '{{ $json.body.BillingState }}' },
    },
    {
      id: 'b_normalize',
      groupId: 'g_usps',
      type: 'webhook',
      options: {
        url:
          'https://secure.shippingapis.com/ShippingAPI.dll?API=Verify&XML=' +
          '<AddressValidateRequest USERID="{{USPS_USER_ID}}"><Revision>1</Revision>' +
          '<Address ID="0"><Address1></Address1><Address2>{{address.street}}</Address2>' +
          '<City>{{address.city}}</City><State>{{address.state}}</State>' +
          '<Zip5>{{address.zip}}</Zip5><Zip4/></Address></AddressValidateRequest>',
        method: 'GET',
      },
    },
    {
      id: 'b_patch_sf',
      groupId: 'g_patch',
      type: 'webhook',
      options: {
        url: 'https://acme.my.salesforce.com/services/data/v59.0/sobjects/Account/{{account.id}}',
        method: 'PATCH',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{SALESFORCE_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"BillingStreet":"{{ $json.AddressValidateResponse.Address.Address2 }}","BillingCity":"{{ $json.AddressValidateResponse.Address.City }}","BillingState":"{{ $json.AddressValidateResponse.Address.State }}","BillingPostalCode":"{{ $json.AddressValidateResponse.Address.Zip5 }}-{{ $json.AddressValidateResponse.Address.Zip4 }}","Address_Validated__c":true}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
