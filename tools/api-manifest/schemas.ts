/**
 * Reusable component schemas referenced from `EndpointSpec`s via
 * `{ $ref: '#/components/schemas/<Name>' }`. Kept in one place so the
 * generator can dump them straight into `components.schemas` without
 * walking every spec.
 */

import type { JsonSchema } from './types';

export const sharedSchemas: Readonly<Record<string, JsonSchema>> = {
  /* ── Identity ─────────────────────────────────────────────────────────── */

  Me: {
    type: 'object',
    required: ['tenant_id', 'scopes', 'tier'],
    properties: {
      tenant_id: { type: 'string' },
      scopes: { type: 'array', items: { type: 'string' } },
      tier: { type: 'string', enum: ['FREE', 'PRO', 'ENTERPRISE'] },
    },
  },

  /* ── Contacts ─────────────────────────────────────────────────────────── */

  Contact: {
    type: 'object',
    required: ['id', 'tenantId', 'createdAt'],
    properties: {
      id: { type: 'string' },
      tenantId: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  ContactCreate: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
    },
  },

  ContactsList: {
    type: 'object',
    required: ['data'],
    properties: {
      data: { type: 'array', items: { $ref: '#/components/schemas/Contact' } },
      next_cursor: { type: 'string', nullable: true },
    },
  },

  /* ── WhatsApp send ────────────────────────────────────────────────────── */

  SendTextBody: {
    type: 'object',
    required: ['messageText'],
    properties: {
      messageText: { type: 'string', minLength: 1, maxLength: 4096 },
      contactId: { type: 'string', description: 'Existing contact id. If absent, supply the triple below.' },
      waId: { type: 'string', description: 'WhatsApp ID (E.164 phone). Required without contactId.' },
      phoneNumberId: { type: 'string', description: 'Sending phone number id. Required without contactId.' },
      projectId: { type: 'string', description: 'Wachat project id. Required without contactId.' },
    },
  },

  SendAck: {
    type: 'object',
    required: ['success'],
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
    },
  },

  /* ── WhatsApp send (extended) ─────────────────────────────────────────── */

  WachatSendBody: {
    type: 'object',
    required: ['kind', 'projectId', 'contactId', 'phoneNumberId', 'waId'],
    properties: {
      kind: { type: 'string', enum: ['text', 'image', 'video', 'document', 'audio'] },
      projectId: { type: 'string' },
      contactId: { type: 'string' },
      phoneNumberId: { type: 'string' },
      waId: { type: 'string' },
      messageText: { type: 'string', description: 'Required when kind === text' },
      mediaUrl: { type: 'string', description: 'For image/video/document/audio variants' },
      caption: { type: 'string' },
      fileName: { type: 'string' },
    },
  },
  ResolveContactBody: {
    type: 'object',
    required: ['projectId', 'phoneNumberId', 'waId'],
    properties: {
      projectId: { type: 'string' },
      phoneNumberId: { type: 'string' },
      waId: { type: 'string' },
    },
  },
  ResolveContactResult: {
    type: 'object',
    required: ['id', 'projectId', 'phoneNumberId', 'waId'],
    properties: {
      id: { type: 'string' },
      projectId: { type: 'string' },
      phoneNumberId: { type: 'string' },
      waId: { type: 'string' },
    },
  },

  /* ── SMS send ─────────────────────────────────────────────────────────── */

  SmsTemplateBody: {
    type: 'object',
    required: ['recipient', 'dltTemplateId'],
    properties: {
      recipient: { type: 'string', description: 'E.164 destination number.' },
      dltTemplateId: { type: 'string' },
      headerId: { type: 'string' },
      variables: {
        type: 'array',
        items: { type: 'string' },
        description: 'Positional template variables. An object body is also accepted; values are stringified in declaration order.',
      },
    },
  },

  SmsSendAck: {
    type: 'object',
    required: ['success'],
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      messageId: { type: 'string' },
    },
  },

  /* ── Acknowledgement (generic 200 body) ───────────────────────────────── */

  Acknowledged: {
    type: 'object',
    required: ['success'],
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
    },
  },

  /* ── API keys ─────────────────────────────────────────────────────────── */

  ApiKey: {
    type: 'object',
    required: ['id', 'name', 'prefix', 'scopes', 'tier', 'env', 'createdAt'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      prefix: { type: 'string', description: 'First 8 chars of the plain key, e.g. "sab_live"' },
      scopes: { type: 'array', items: { type: 'string' } },
      tier: { type: 'string', enum: ['FREE', 'PRO', 'ENTERPRISE'] },
      env: { type: 'string', enum: ['live', 'test'] },
      createdAt: { type: 'string', format: 'date-time' },
      lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
      expiresAt: { type: 'string', format: 'date-time', nullable: true },
      revoked: { type: 'boolean' },
    },
  },
  ApiKeyList: {
    type: 'object',
    required: ['data'],
    properties: {
      data: { type: 'array', items: { $ref: '#/components/schemas/ApiKey' } },
    },
  },
  ApiKeyCreate: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      scopes: { type: 'array', items: { type: 'string' }, description: 'Defaults to ["*"] if omitted.' },
      env: { type: 'string', enum: ['live', 'test'], default: 'live' },
      tier: { type: 'string', enum: ['FREE', 'PRO', 'ENTERPRISE'] },
      expiresAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  ApiKeyCreated: {
    type: 'object',
    required: ['key', 'apiKey'],
    properties: {
      apiKey: { type: 'string', description: 'The plain-text key — shown ONCE.' },
      key: { $ref: '#/components/schemas/ApiKey' },
    },
  },

  /* ── Personal Access Tokens ───────────────────────────────────────────── */

  Pat: {
    type: 'object',
    required: ['id', 'name', 'scopes', 'tier', 'createdAt', 'userId'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      userId: { type: 'string' },
      scopes: { type: 'array', items: { type: 'string' } },
      tier: { type: 'string', enum: ['FREE', 'PRO', 'ENTERPRISE'] },
      createdAt: { type: 'string', format: 'date-time' },
      lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
      expiresAt: { type: 'string', format: 'date-time', nullable: true },
      revoked: { type: 'boolean' },
    },
  },
  PatList: {
    type: 'object',
    required: ['data'],
    properties: {
      data: { type: 'array', items: { $ref: '#/components/schemas/Pat' } },
    },
  },
  PatCreate: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      scopes: { type: 'array', items: { type: 'string' } },
      expiresAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  PatCreated: {
    type: 'object',
    required: ['token', 'pat'],
    properties: {
      token: { type: 'string', description: 'The plain-text token — shown ONCE.' },
      pat: { $ref: '#/components/schemas/Pat' },
    },
  },

  /* ── Account / team / plan / RBAC ─────────────────────────────────────── */

  Account: {
    type: 'object',
    required: ['tenantId'],
    properties: {
      tenantId: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      timezone: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  TeamMember: {
    type: 'object',
    required: ['userId', 'email'],
    properties: {
      userId: { type: 'string' },
      email: { type: 'string', format: 'email' },
      name: { type: 'string' },
      role: { type: 'string' },
      joinedAt: { type: 'string', format: 'date-time' },
    },
  },
  TeamMembersList: {
    type: 'object',
    required: ['data'],
    properties: {
      data: { type: 'array', items: { $ref: '#/components/schemas/TeamMember' } },
    },
  },
  CurrentPlan: {
    type: 'object',
    required: ['planId'],
    properties: {
      planId: { type: 'string' },
      name: { type: 'string' },
      tier: { type: 'string', enum: ['FREE', 'PRO', 'ENTERPRISE'] },
      renewsAt: { type: 'string', format: 'date-time', nullable: true },
      limits: { type: 'object', description: 'Per-module quota limits' },
    },
  },
  Role: {
    type: 'object',
    required: ['id', 'name', 'permissions'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      permissions: { type: 'array', items: { type: 'string' } },
    },
  },
  RolesList: {
    type: 'object',
    required: ['data'],
    properties: {
      data: { type: 'array', items: { $ref: '#/components/schemas/Role' } },
    },
  },
};
