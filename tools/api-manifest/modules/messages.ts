/**
 * Messages module — WhatsApp Cloud send surface.
 *
 * Phase 0 ports a single endpoint:
 *
 *   POST /messages/send-text — send a plain-text WhatsApp message via the
 *     Rust `wachat-send` pipeline. The handler resolves a contact when the
 *     caller passes `waId` + `phoneNumberId` + `projectId` rather than a
 *     direct `contactId`.
 *
 * Logic stays in `_handlers.ts` because the resolve-or-reuse contact step
 * has non-trivial branching.
 */

import type { EndpointSpec } from '../types';

export const messagesEndpoints: ReadonlyArray<EndpointSpec> = [
  {
    module: 'messages',
    resource: 'messages',
    verb: 'custom',
    path: '/messages/send-text',
    method: 'POST',
    scope: 'messages:write',
    tier: 'FREE',
    summary: 'Send a WhatsApp text message',
    description:
      'Sends a plain-text WhatsApp message. Provide either a `contactId` or ' +
      'the triple (`waId`, `phoneNumberId`, `projectId`) and the platform ' +
      'will resolve / create the contact for you.',
    requestBody: {
      required: true,
      schema: { $ref: '#/components/schemas/SendTextBody' },
    },
    responses: {
      '2xx': {
        description: 'Send accepted',
        schema: { $ref: '#/components/schemas/SendAck' },
      },
      '400': { description: 'Missing required fields' },
      '401': { description: 'Missing or invalid API key' },
      '403': { description: 'Missing required scope' },
      '429': { description: 'Rate limit exceeded' },
      '500': { description: 'Upstream Rust pipeline failure' },
    },
    delegate: { kind: 'handler', export: 'sendText' },
    emits: ['wachat.message.sent'],
    credits: 1,
    idempotent: true,
  },
];
