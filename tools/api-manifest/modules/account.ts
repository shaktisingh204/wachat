/**
 * Account, team, plans, and RBAC role read endpoints.
 *
 * All read-only and tenant-scoped — useful for developer dashboards that
 * need to render "who am I, what plan am I on, who's on my team".
 */

import type { EndpointSpec } from '../types';

export const accountEndpoints: ReadonlyArray<EndpointSpec> = [
  {
    module: 'identity',
    resource: 'account',
    verb: 'get',
    path: '/account',
    method: 'GET',
    scope: 'me:read',
    tier: 'FREE',
    summary: 'Return the tenant account profile',
    responses: {
      '2xx': {
        description: 'Account profile',
        schema: { $ref: '#/components/schemas/Account' },
      },
      '401': { description: 'Missing or invalid API key' },
      '429': { description: 'Rate limit exceeded' },
    },
    delegate: { kind: 'handler', export: 'getAccount', from: '@/lib/api-platform/handlers/identity' },
  },
  {
    module: 'identity',
    resource: 'team',
    verb: 'list',
    path: '/team/members',
    method: 'GET',
    scope: 'me:read',
    tier: 'FREE',
    summary: 'List members of the calling tenant',
    responses: {
      '2xx': {
        description: 'Team members',
        schema: { $ref: '#/components/schemas/TeamMembersList' },
      },
      '401': { description: 'Missing or invalid API key' },
      '429': { description: 'Rate limit exceeded' },
    },
    delegate: { kind: 'handler', export: 'listTeamMembers', from: '@/lib/api-platform/handlers/identity' },
  },
  {
    module: 'identity',
    resource: 'plans',
    verb: 'get',
    path: '/plans/current',
    method: 'GET',
    scope: 'billing:read',
    tier: 'FREE',
    summary: 'Return the current subscription plan + limits',
    responses: {
      '2xx': {
        description: 'Current plan',
        schema: { $ref: '#/components/schemas/CurrentPlan' },
      },
      '401': { description: 'Missing or invalid API key' },
      '429': { description: 'Rate limit exceeded' },
    },
    delegate: { kind: 'handler', export: 'getCurrentPlan', from: '@/lib/api-platform/handlers/identity' },
  },
  {
    module: 'identity',
    resource: 'rbac',
    verb: 'list',
    path: '/rbac/roles',
    method: 'GET',
    scope: 'me:read',
    tier: 'FREE',
    summary: 'List roles defined for the calling tenant',
    responses: {
      '2xx': {
        description: 'Roles + permissions',
        schema: { $ref: '#/components/schemas/RolesList' },
      },
      '401': { description: 'Missing or invalid API key' },
      '429': { description: 'Rate limit exceeded' },
    },
    delegate: { kind: 'handler', export: 'listRoles', from: '@/lib/api-platform/handlers/identity' },
  },
];
