/**
 * Recipe: Domain MX-record probe before adding to email list.
 *
 * Pre-flight check before bulk-importing an email list. For each domain in
 * the import, we query a public DNS-over-HTTPS endpoint for MX records; if
 * none exist (or the domain is on the corporate disposable-domains list)
 * the address is rejected before it ever sees the ESP.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'data-enrich-mx-probe',
  name: 'Data: MX-record probe before list import',
  category: 'ops',
  description:
    'Before importing an email list, query DNS for MX records on each domain and reject addresses on dead or disposable domains.',
  tags: ['enrichment', 'dns', 'mx', 'deliverability', 'list-hygiene'],
  trigger: {
    id: 't_import_started',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/lists/import-started',
      method: 'POST',
      authentication: 'none',
      responseMode: 'lastNode',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_list_id', name: 'list.id', defaultValue: '' },
    { id: 'v_email', name: 'addr.email', defaultValue: '' },
    { id: 'v_domain', name: 'addr.domain', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_loop',
      groupId: 'g_loop',
      type: 'loop',
      options: { items: '{{ $json.body.addresses }}', itemVariable: 'addr' },
    },
    {
      id: 'b_split_domain',
      groupId: 'g_split',
      type: 'set_variable',
      options: { variableName: 'addr.domain', value: '{{ addr.email.split("@")[1] }}' },
    },
    {
      id: 'b_disposable',
      groupId: 'g_disposable',
      type: 'webhook',
      options: {
        url: '/api/internal/disposable-domains/check?domain={{addr.domain}}',
        method: 'GET',
        headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{INTERNAL_TOKEN}}' }],
      },
    },
    {
      id: 'b_mx',
      groupId: 'g_mx',
      type: 'webhook',
      options: {
        url: 'https://cloudflare-dns.com/dns-query?name={{addr.domain}}&type=MX',
        method: 'GET',
        headers: [{ id: 'h1', key: 'Accept', value: 'application/dns-json' }],
      },
    },
    {
      id: 'b_decide',
      groupId: 'g_decide',
      type: 'condition',
      options: {
        logicalOperator: 'AND',
        conditionGroups: [
          {
            id: 'cg1',
            logicalOperator: 'AND',
            comparisons: [
              { id: 'c1', variableId: 'v_domain', operator: 'Is set', value: '' },
            ],
          },
        ],
      },
    },
    {
      id: 'b_record',
      groupId: 'g_record',
      type: 'webhook',
      options: {
        url: '/api/lists/{{list.id}}/results',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content:
            '{"email":"{{addr.email}}","domain":"{{addr.domain}}","mxRecords":{{ $json.Answer }},"verdict":"{{ ($json.Answer && $json.Answer.length > 0) ? `keep` : `drop` }}"}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
