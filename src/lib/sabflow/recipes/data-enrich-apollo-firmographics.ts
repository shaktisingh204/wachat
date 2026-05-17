/**
 * Recipe: Apollo firmographic enrichment → CRM.
 *
 * Daily cron pulls accounts that landed in the past 24h with thin company
 * data (no employee count, no industry). For each, we fetch Apollo's people-
 * enrichment endpoint and write the firmographics (employees, industry,
 * funding stage, tech stack) back to the account.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'data-enrich-apollo-firmographics',
  name: 'Data: Apollo firmographic enrichment',
  category: 'crm',
  description:
    'Nightly pass over thin accounts — fetch Apollo company data and backfill industry, headcount, funding, and tech stack in the CRM.',
  tags: ['enrichment', 'apollo', 'firmographics', 'crm', 'sales'],
  trigger: {
    id: 't_nightly_enrich',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_tick',
    options: { cronExpression: '0 2 * * *' },
  },
  variables: [
    { id: 'v_window', name: 'enrich.lookbackHours', defaultValue: '24' },
  ],
  blocks: [
    {
      id: 'b_pull',
      groupId: 'g_pull',
      type: 'webhook',
      options: {
        url: '/api/crm/accounts/thin?createdWithinHours={{enrich.lookbackHours}}',
        method: 'GET',
        headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{INTERNAL_TOKEN}}' }],
      },
    },
    {
      id: 'b_loop',
      groupId: 'g_loop',
      type: 'loop',
      options: { items: '{{ $json.accounts }}', itemVariable: 'acct' },
    },
    {
      id: 'b_apollo',
      groupId: 'g_apollo',
      type: 'webhook',
      options: {
        url: 'https://api.apollo.io/api/v1/organizations/enrich?domain={{acct.domain}}',
        method: 'GET',
        headers: [
          { id: 'h1', key: 'X-Api-Key', value: '{{APOLLO_API_KEY}}' },
          { id: 'h2', key: 'Accept', value: 'application/json' },
        ],
      },
    },
    {
      id: 'b_patch',
      groupId: 'g_patch',
      type: 'webhook',
      options: {
        url: '/api/crm/accounts/{{acct.id}}',
        method: 'PATCH',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content:
            '{"industry":"{{ $json.organization.industry }}","employees":{{ $json.organization.estimated_num_employees }},"foundedYear":{{ $json.organization.founded_year }},"fundingStage":"{{ $json.organization.latest_funding_stage }}","techStack":{{ $json.organization.current_technologies }},"enrichedAt":"{{ $now }}","enrichmentSource":"apollo"}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
