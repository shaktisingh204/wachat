/**
 * Contacts module — `api_contacts` Mongo collection.
 *
 * Ports the existing hand-written `/api/v1/contacts/route.ts` (GET + POST)
 * into the manifest. The actual business logic stays hand-written in a
 * co-located `_handlers.ts` so the generator can keep emitting plain
 * plumbing — this is the canonical pattern for non-trivial endpoints.
 */

import type { EndpointSpec } from '../types';

export const contactsEndpoints: ReadonlyArray<EndpointSpec> = [
  {
    module: 'contacts',
    resource: 'contacts',
    verb: 'list',
    path: '/contacts',
    method: 'GET',
    scope: 'contacts:read',
    tier: 'FREE',
    summary: 'List contacts (cursor paginated)',
    description:
      'Returns a page of contacts owned by the authenticated tenant. ' +
      'Pagination uses an opaque cursor — pass the `next_cursor` from a ' +
      'previous response back as `cursor` to fetch the next page.',
    queryParams: [
      {
        name: 'cursor',
        schema: { type: 'string' },
        description: 'Opaque cursor returned by a previous call. Omit on the first page.',
      },
      {
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
        description: 'Page size. Capped at 100.',
      },
    ],
    responses: {
      '2xx': {
        description: 'A page of contacts',
        schema: { $ref: '#/components/schemas/ContactsList' },
      },
      '400': { description: 'Invalid cursor' },
      '401': { description: 'Missing or invalid API key' },
      '403': { description: 'Missing required scope' },
      '429': { description: 'Rate limit exceeded' },
    },
    delegate: { kind: 'handler', export: 'listContacts' },
  },
  {
    module: 'contacts',
    resource: 'contacts',
    verb: 'create',
    path: '/contacts',
    method: 'POST',
    scope: 'contacts:write',
    tier: 'FREE',
    summary: 'Create a contact',
    description:
      'Creates a contact owned by the authenticated tenant. At least one of ' +
      '`name`, `email` or `phone` must be provided.',
    requestBody: {
      required: true,
      schema: { $ref: '#/components/schemas/ContactCreate' },
      description: 'Contact fields. All optional but at least one of name/email/phone is required.',
    },
    responses: {
      '2xx': {
        description: 'Created',
        schema: { $ref: '#/components/schemas/Contact' },
      },
      '400': { description: 'Invalid payload' },
      '401': { description: 'Missing or invalid API key' },
      '403': { description: 'Missing required scope' },
      '429': { description: 'Rate limit exceeded' },
    },
    delegate: { kind: 'handler', export: 'createContact' },
    emits: ['contact.created'],
  },
];
