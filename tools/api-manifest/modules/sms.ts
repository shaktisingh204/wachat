/**
 * SMS module — DLT-template transactional SMS.
 *
 * Phase 0 ports a single endpoint:
 *
 *   POST /sms/send-template — send a DLT-approved template SMS via
 *     `@/lib/sms/services/messaging.service::sendTemplateSms`.
 */

import type { EndpointSpec } from '../types';

export const smsEndpoints: ReadonlyArray<EndpointSpec> = [
  {
    module: 'sms',
    resource: 'sms',
    verb: 'custom',
    path: '/sms/send-template',
    method: 'POST',
    scope: 'messages:write',
    tier: 'FREE',
    summary: 'Send a DLT template SMS',
    description:
      'Sends a transactional SMS using a DLT-approved template. ' +
      '`variables` may be an array (positional) or a string-keyed object ' +
      '(named) — the values are coerced to strings and substituted into the ' +
      'template in declaration order.',
    requestBody: {
      required: true,
      schema: { $ref: '#/components/schemas/SmsTemplateBody' },
    },
    responses: {
      '2xx': {
        description: 'SMS queued for delivery',
        schema: { $ref: '#/components/schemas/SmsSendAck' },
      },
      '400': { description: 'Missing recipient or dltTemplateId' },
      '401': { description: 'Missing or invalid API key' },
      '403': { description: 'Missing required scope' },
      '429': { description: 'Rate limit exceeded' },
    },
    delegate: { kind: 'handler', export: 'sendTemplateSms' },
    emits: ['sms.message.sent'],
    credits: 1,
    idempotent: true,
  },
];
