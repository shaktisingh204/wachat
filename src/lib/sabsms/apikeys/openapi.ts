/**
 * SabSMS public API — hand-written OpenAPI 3.1 spec (V2.13).
 *
 * Served verbatim at `GET /api/v1/sms/openapi.json` and consumed by the
 * /sabsms/api-docs + /sabsms/sdk-reference pages (which derive their
 * endpoint lists and code snippets from THIS object — one source of
 * truth, no drift).
 *
 * CLIENT-SAFE: pure data + pure functions, no `server-only`, no Node
 * APIs — both docs pages are client components.
 */

import type { SabsmsApiScope } from './scopes';

export const SABSMS_API_BASE_PATH = '/api/v1/sms';
export const SABSMS_API_VERSION = '1.0.0';

// ─── Minimal local OpenAPI typing (just what we emit) ──────────────────────

interface SchemaObject {
  type?: string;
  format?: string;
  description?: string;
  enum?: string[];
  items?: SchemaObject;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  additionalProperties?: boolean | SchemaObject;
  example?: unknown;
  nullable?: boolean;
}

interface ParameterObject {
  name: string;
  in: 'path' | 'query' | 'header';
  required?: boolean;
  description?: string;
  schema: SchemaObject;
}

interface OperationObject {
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  /** SabSMS extension — the API-key scope this operation requires. */
  'x-scopes': SabsmsApiScope[];
  parameters?: ParameterObject[];
  requestBody?: {
    required: boolean;
    content: { 'application/json': { schema: SchemaObject } };
  };
  responses: Record<
    string,
    { description: string; content?: { 'application/json': { schema: SchemaObject } } }
  >;
  security?: Array<Record<string, string[]>>;
}

export interface SabsmsOpenApiSpec {
  openapi: '3.1.0';
  info: { title: string; version: string; description: string };
  servers: Array<{ url: string; description?: string }>;
  paths: Record<string, Partial<Record<'get' | 'post' | 'delete', OperationObject>>>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, SchemaObject>;
  };
  security: Array<Record<string, string[]>>;
}

// ─── Shared schemas ────────────────────────────────────────────────────────

const ERROR_SCHEMA: SchemaObject = {
  type: 'object',
  description:
    'Every non-2xx response uses this envelope. `code` is a stable machine-readable string; an `x-request-id` header is echoed on every response for support correlation.',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'validation_failed' },
        message: { type: 'string', example: 'to must be E.164' },
      },
      required: ['code', 'message'],
    },
  },
  required: ['error'],
};

const MESSAGE_SCHEMA: SchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'string', example: '665f1c2ab8d34e0012345678' },
    to: { type: 'string', example: '+14155550100' },
    from: { type: 'string', nullable: true, example: '+18335550199' },
    body: { type: 'string', example: 'Your code is 49201' },
    direction: { type: 'string', enum: ['outbound', 'inbound'] },
    channel: { type: 'string', enum: ['sms', 'mms', 'rcs'] },
    category: {
      type: 'string',
      enum: ['transactional', 'otp', 'marketing', 'alert', 'service'],
    },
    status: {
      type: 'string',
      enum: [
        'queued',
        'sending',
        'sent',
        'delivered',
        'failed',
        'undelivered',
        'rejected',
        'suppressed',
      ],
    },
    segments: { type: 'integer', nullable: true, example: 1 },
    errorCode: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'to', 'body', 'status'],
};

const SEND_MESSAGE_BODY: SchemaObject = {
  type: 'object',
  properties: {
    to: { type: 'string', description: 'Destination phone, E.164.', example: '+14155550100' },
    body: {
      type: 'string',
      description:
        'Message text. Ignored when templateId is set (the stored template body is the compliance-reviewed source of truth).',
    },
    from: { type: 'string', description: 'Sender number or registered sender ID.' },
    category: {
      type: 'string',
      enum: ['transactional', 'otp', 'marketing', 'alert', 'service'],
      description: 'Routing/compliance category. Default: transactional.',
    },
    templateId: { type: 'string', description: 'Send a stored, reviewed template.' },
    vars: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'Values for {{name}} template placeholders.',
    },
    mediaSabFileIds: {
      type: 'array',
      items: { type: 'string' },
      description:
        'SabFiles file ids for MMS media. Raw URLs are NOT accepted — every file lives in SabFiles.',
    },
    idempotencyKeyNote: {
      type: 'string',
      description:
        'Not a body field — send an Idempotency-Key HEADER to make this request safely retryable for 24h.',
    },
  },
  required: ['to'],
};

const SUPPRESSION_SCHEMA: SchemaObject = {
  type: 'object',
  properties: {
    phoneHash: {
      type: 'string',
      description: 'sha-256 hex of the E.164 phone (raw numbers are never stored).',
    },
    source: {
      type: 'string',
      enum: ['stop', 'complaint', 'bounce', 'manual', 'carrier_block', 'import'],
    },
    reason: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['phoneHash', 'source'],
};

// ─── The spec ──────────────────────────────────────────────────────────────

export function buildSabsmsOpenApiSpec(): SabsmsOpenApiSpec {
  return {
    openapi: '3.1.0',
    info: {
      title: 'SabSMS API',
      version: SABSMS_API_VERSION,
      description:
        'Programmatic SMS/MMS sending, OTP verification, suppression management and analytics. Authenticate every request with `Authorization: Bearer sk_live_…` (mint keys at /sabsms/api-keys). Per-key rate limits apply; 429 responses carry a Retry-After header.',
    },
    servers: [{ url: SABSMS_API_BASE_PATH, description: 'Same-origin SabNode deployment' }],
    security: [{ apiKey: [] }],
    components: {
      securitySchemes: {
        apiKey: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'sk_live_…',
          description: 'SabSMS API key (Authorization: Bearer sk_live_…).',
        },
      },
      schemas: {
        Error: ERROR_SCHEMA,
        Message: MESSAGE_SCHEMA,
        Suppression: SUPPRESSION_SCHEMA,
      },
    },
    paths: {
      '/messages': {
        post: {
          operationId: 'sendMessage',
          summary: 'Send a message',
          description:
            'Enqueue a single outbound SMS/MMS through the full compliance + routing + credit pipeline. Honors an Idempotency-Key header for 24h: replays return the original response.',
          tags: ['Messages'],
          'x-scopes': ['messages:send'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: SEND_MESSAGE_BODY } },
          },
          responses: {
            '201': {
              description: 'Message accepted and queued.',
              content: { 'application/json': { schema: MESSAGE_SCHEMA } },
            },
            '422': {
              description: 'Validation failed.',
              content: { 'application/json': { schema: ERROR_SCHEMA } },
            },
            '429': {
              description: 'Rate limited (Retry-After header set).',
              content: { 'application/json': { schema: ERROR_SCHEMA } },
            },
          },
        },
        get: {
          operationId: 'listMessages',
          summary: 'List messages',
          description: 'Workspace-scoped message list, newest first.',
          tags: ['Messages'],
          'x-scopes': ['messages:read'],
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: [
                  'queued',
                  'sending',
                  'sent',
                  'delivered',
                  'failed',
                  'undelivered',
                  'rejected',
                  'suppressed',
                ],
              },
              description: 'Filter by delivery status.',
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', example: 20 },
              description: 'Max rows (1–100, default 20).',
            },
          ],
          responses: {
            '200': {
              description: 'Message page.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: MESSAGE_SCHEMA },
                    },
                    required: ['data'],
                  },
                },
              },
            },
          },
        },
      },
      '/messages/{id}': {
        get: {
          operationId: 'getMessage',
          summary: 'Retrieve a message',
          description: 'Fetch one message by id (workspace-scoped).',
          tags: ['Messages'],
          'x-scopes': ['messages:read'],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'The message.',
              content: { 'application/json': { schema: MESSAGE_SCHEMA } },
            },
            '404': {
              description: 'Unknown id for this workspace.',
              content: { 'application/json': { schema: ERROR_SCHEMA } },
            },
          },
        },
      },
      '/verify/send': {
        post: {
          operationId: 'verifySend',
          summary: 'Send an OTP',
          description:
            'Generate + send a one-time code (engine-side fraud guard, rate limits and resend cooldowns apply).',
          tags: ['Verify'],
          'x-scopes': ['otp'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    to: { type: 'string', example: '+14155550100' },
                  },
                  required: ['to'],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'OTP queued.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      otpId: { type: 'string' },
                      expiresAt: { type: 'integer', description: 'Epoch seconds.' },
                      resendAfter: { type: 'integer', description: 'Epoch seconds.' },
                    },
                    required: ['otpId', 'expiresAt', 'resendAfter'],
                  },
                },
              },
            },
            '403': {
              description: 'Blocked by the fraud guard.',
              content: { 'application/json': { schema: ERROR_SCHEMA } },
            },
            '429': {
              description: 'Cooldown / rate limited.',
              content: { 'application/json': { schema: ERROR_SCHEMA } },
            },
          },
        },
      },
      '/verify/check': {
        post: {
          operationId: 'verifyCheck',
          summary: 'Check an OTP',
          description:
            'Verify a code (constant-time engine-side). Success consumes the code and records the conversion.',
          tags: ['Verify'],
          'x-scopes': ['otp'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    to: { type: 'string', example: '+14155550100' },
                    code: { type: 'string', example: '492013' },
                  },
                  required: ['to', 'code'],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Verification outcome.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      verified: { type: 'boolean' },
                      reason: {
                        type: 'string',
                        nullable: true,
                        enum: ['expired', 'wrong_code', 'max_attempts'],
                      },
                    },
                    required: ['verified'],
                  },
                },
              },
            },
          },
        },
      },
      '/suppressions': {
        get: {
          operationId: 'listSuppressions',
          summary: 'List suppressions',
          description: 'Workspace suppression list (opt-outs, complaints, manual blocks).',
          tags: ['Suppressions'],
          'x-scopes': ['messages:read'],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', example: 100 },
              description: 'Max rows (1–500, default 100).',
            },
          ],
          responses: {
            '200': {
              description: 'Suppression page.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: SUPPRESSION_SCHEMA },
                    },
                    required: ['data'],
                  },
                },
              },
            },
          },
        },
        post: {
          operationId: 'addSuppression',
          summary: 'Suppress a phone',
          description: 'Add a phone to the suppression list (sends to it are blocked).',
          tags: ['Suppressions'],
          'x-scopes': ['messages:send'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    phone: { type: 'string', example: '+14155550100' },
                    reason: { type: 'string' },
                  },
                  required: ['phone'],
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Suppression stored.',
              content: { 'application/json': { schema: SUPPRESSION_SCHEMA } },
            },
          },
        },
      },
      '/suppressions/{phone}': {
        delete: {
          operationId: 'deleteSuppression',
          summary: 'Unsuppress a phone',
          description:
            'Remove a suppression. `phone` may be the E.164 number or its sha-256 hash.',
          tags: ['Suppressions'],
          'x-scopes': ['messages:send'],
          parameters: [
            { name: 'phone', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Removed (idempotent).',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { removed: { type: 'boolean' } },
                    required: ['removed'],
                  },
                },
              },
            },
          },
        },
      },
      '/analytics/summary': {
        get: {
          operationId: 'analyticsSummary',
          summary: 'Analytics summary',
          description:
            'Aggregated daily counters (sent/delivered/failed/inbound/opt-outs/clicks/segments/credits) over a date range, read from precomputed rollups.',
          tags: ['Analytics'],
          'x-scopes': ['analytics:read'],
          parameters: [
            {
              name: 'from',
              in: 'query',
              schema: { type: 'string', format: 'date', example: '2026-06-01' },
              description: 'Inclusive UTC start day. Default: 30 days ago.',
            },
            {
              name: 'to',
              in: 'query',
              schema: { type: 'string', format: 'date', example: '2026-06-12' },
              description: 'Inclusive UTC end day. Default: today.',
            },
          ],
          responses: {
            '200': {
              description: 'Totals + per-day series.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      from: { type: 'string', format: 'date' },
                      to: { type: 'string', format: 'date' },
                      totals: { type: 'object', additionalProperties: { type: 'integer' } },
                      days: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            date: { type: 'string', format: 'date' },
                            counters: {
                              type: 'object',
                              additionalProperties: { type: 'integer' },
                            },
                          },
                          required: ['date', 'counters'],
                        },
                      },
                    },
                    required: ['from', 'to', 'totals', 'days'],
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

// ─── Docs view models (shared by api-docs + sdk-reference pages) ───────────

export interface SabsmsDocParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface SabsmsDocEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  group: string;
  title: string;
  description: string;
  scopes: SabsmsApiScope[];
  parameters: SabsmsDocParam[];
  /** language label → snippet. */
  codeExamples: Record<string, string>;
  response: string | null;
}

const EXAMPLE_BODIES: Record<string, unknown> = {
  sendMessage: { to: '+14155550100', body: 'Your code is 49201', category: 'transactional' },
  verifySend: { to: '+14155550100' },
  verifyCheck: { to: '+14155550100', code: '492013' },
  addSuppression: { phone: '+14155550100', reason: 'customer request' },
};

const EXAMPLE_RESPONSES: Record<string, unknown> = {
  sendMessage: {
    id: '665f1c2ab8d34e0012345678',
    to: '+14155550100',
    body: 'Your code is 49201',
    status: 'queued',
    category: 'transactional',
    segments: 1,
    createdAt: '2026-06-12T12:00:00.000Z',
  },
  listMessages: {
    data: [
      {
        id: '665f1c2ab8d34e0012345678',
        to: '+14155550100',
        body: 'Your code is 49201',
        status: 'delivered',
        createdAt: '2026-06-12T12:00:00.000Z',
      },
    ],
  },
  getMessage: {
    id: '665f1c2ab8d34e0012345678',
    to: '+14155550100',
    body: 'Your code is 49201',
    status: 'delivered',
    errorCode: null,
    createdAt: '2026-06-12T12:00:00.000Z',
  },
  verifySend: { otpId: 'otp_8f3k…', expiresAt: 1780000000, resendAfter: 1779999700 },
  verifyCheck: { verified: true },
  listSuppressions: {
    data: [
      {
        phoneHash: '3c9a…64-hex…b1',
        source: 'stop',
        reason: 'STOP keyword',
        createdAt: '2026-06-10T08:00:00.000Z',
      },
    ],
  },
  addSuppression: {
    phoneHash: '3c9a…64-hex…b1',
    source: 'manual',
    reason: 'customer request',
    createdAt: '2026-06-12T12:00:00.000Z',
  },
  deleteSuppression: { removed: true },
  analyticsSummary: {
    from: '2026-06-01',
    to: '2026-06-12',
    totals: { sent: 1240, delivered: 1198, failed: 18, inbound: 211, creditsSpent: 1304 },
    days: [{ date: '2026-06-12', counters: { sent: 96, delivered: 93 } }],
  },
};

function schemaTypeLabel(s: SchemaObject): string {
  if (s.enum) return `enum(${s.enum.slice(0, 3).join('|')}${s.enum.length > 3 ? '|…' : ''})`;
  if (s.type === 'array') return `array[${s.items?.type ?? 'object'}]`;
  return s.format ? `${s.type} (${s.format})` : (s.type ?? 'object');
}

function curlFor(method: string, path: string, body: unknown): string {
  const lines = [
    `curl -X ${method} "https://YOUR_HOST${SABSMS_API_BASE_PATH}${path.replace('{id}', '665f1c2ab8d34e0012345678').replace('{phone}', '%2B14155550100')}" \\`,
    // Angle-bracket placeholder: a bare sk_live_<32 alnum> literal trips
    // GitHub secret-scanning push protection (Stripe key pattern).
    `  -H "Authorization: Bearer sk_live_<YOUR_API_KEY>"`,
  ];
  if (body !== undefined) {
    lines[lines.length - 1] += ' \\';
    lines.push(`  -H "Content-Type: application/json" \\`);
    lines.push(`  -d '${JSON.stringify(body, null, 2).replace(/\n/g, '\n  ')}'`);
  }
  return lines.join('\n');
}

function nodeFor(method: string, path: string, body: unknown): string {
  const url = `https://YOUR_HOST${SABSMS_API_BASE_PATH}${path.replace('{id}', '${id}').replace('{phone}', '${encodeURIComponent(phone)}')}`;
  return [
    `const res = await fetch(\`${url}\`, {`,
    `  method: '${method}',`,
    `  headers: {`,
    `    Authorization: 'Bearer ' + process.env.SABSMS_API_KEY,`,
    ...(body !== undefined ? [`    'Content-Type': 'application/json',`] : []),
    `  },`,
    ...(body !== undefined ? [`  body: JSON.stringify(${JSON.stringify(body, null, 2).replace(/\n/g, '\n  ')}),`] : []),
    `});`,
    `const data = await res.json();`,
  ].join('\n');
}

function pythonFor(method: string, path: string, body: unknown): string {
  const url = `https://YOUR_HOST${SABSMS_API_BASE_PATH}${path.replace('{id}', '{id}').replace('{phone}', '{phone}')}`;
  return [
    `import os, requests`,
    ``,
    `res = requests.${method.toLowerCase()}(`,
    `    f"${url}",`,
    `    headers={"Authorization": f"Bearer {os.environ['SABSMS_API_KEY']}"},`,
    ...(body !== undefined ? [`    json=${JSON.stringify(body)},`] : []),
    `)`,
    `data = res.json()`,
  ].join('\n');
}

/**
 * Flatten the spec into doc endpoints — the api-docs sidebar/detail and
 * the sdk-reference snippets are both rendered from this list.
 */
export function sabsmsDocEndpoints(): SabsmsDocEndpoint[] {
  const spec = buildSabsmsOpenApiSpec();
  const out: SabsmsDocEndpoint[] = [];

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods) as Array<['get' | 'post' | 'delete', OperationObject]>) {
      const params: SabsmsDocParam[] = [];

      for (const p of op.parameters ?? []) {
        params.push({
          name: p.name,
          type: `${p.in} · ${schemaTypeLabel(p.schema)}`,
          required: !!p.required,
          description: p.description ?? '',
        });
      }
      const bodySchema = op.requestBody?.content['application/json'].schema;
      if (bodySchema?.properties) {
        for (const [name, prop] of Object.entries(bodySchema.properties)) {
          if (name === 'idempotencyKeyNote') continue;
          params.push({
            name,
            type: schemaTypeLabel(prop),
            required: (bodySchema.required ?? []).includes(name),
            description: prop.description ?? '',
          });
        }
      }

      const body = EXAMPLE_BODIES[op.operationId];
      const response = EXAMPLE_RESPONSES[op.operationId];
      const httpMethod = method.toUpperCase() as 'GET' | 'POST' | 'DELETE';

      out.push({
        id: op.operationId,
        method: httpMethod,
        path,
        group: op.tags[0] ?? 'API',
        title: op.summary,
        description: op.description,
        scopes: op['x-scopes'],
        parameters: params,
        codeExamples: {
          cURL: curlFor(httpMethod, path, body),
          'Node.js': nodeFor(httpMethod, path, body),
          Python: pythonFor(httpMethod, path, body),
        },
        response: response ? JSON.stringify(response, null, 2) : null,
      });
    }
  }

  return out;
}
