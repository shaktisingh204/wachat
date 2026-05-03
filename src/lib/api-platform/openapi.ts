/**
 * SabNode Developer Platform — minimal OpenAPI 3.1 builder.
 *
 * `buildOpenApiSpec()` returns a plain JSON object (not a string) describing
 * the public `/api/v1/*` surface.  Keeping the builder programmatic — rather
 * than checking in a giant YAML — means the spec never drifts from the
 * routes themselves and we can introspect it from tests.
 */

import { TIER_LIMITS } from './rate-limit';

/** A subset of OpenAPI 3.1 we actually use. */
export interface OpenApiSpec {
  openapi: '3.1.0';
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers: Array<{ url: string; description?: string }>;
  components: {
    securitySchemes: Record<
      string,
      {
        type: 'http' | 'apiKey' | 'oauth2';
        scheme?: string;
        in?: 'header' | 'query';
        name?: string;
        bearerFormat?: string;
        description?: string;
      }
    >;
    schemas: Record<string, unknown>;
  };
  security: Array<Record<string, string[]>>;
  paths: Record<string, Record<string, unknown>>;
  'x-rate-limits'?: Record<string, number>;
}

/**
 * Construct the OpenAPI 3.1 document for the v1 API.  Pure function — safe
 * to call from edge or node runtimes.
 */
export function buildOpenApiSpec(): OpenApiSpec {
  return {
    openapi: '3.1.0',
    info: {
      title: 'SabNode Public API',
      version: '1.0.0',
      description:
        'Versioned REST API for SabNode tenants.  Authenticate with a Bearer ' +
        'API key; rate limits depend on subscription tier.',
    },
    servers: [
      { url: '/api/v1', description: 'Default server (relative)' },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API-Key',
          description: 'A SabNode API key issued from the developer dashboard.',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
          },
        },
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
        Me: {
          type: 'object',
          required: ['tenant_id', 'scopes'],
          properties: {
            tenant_id: { type: 'string' },
            scopes: { type: 'array', items: { type: 'string' } },
            tier: { type: 'string', enum: ['FREE', 'PRO', 'ENTERPRISE'] },
          },
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    paths: {
      '/': {
        get: {
          summary: 'API metadata',
          security: [],
          responses: {
            '200': {
              description: 'API metadata',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      version: { type: 'string' },
                      status: { type: 'string' },
                      docs_url: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/openapi': {
        get: {
          summary: 'This OpenAPI document',
          security: [],
          responses: { '200': { description: 'OpenAPI 3.1 JSON' } },
        },
      },
      '/me': {
        get: {
          summary: 'Identify the calling tenant',
          responses: {
            '200': {
              description: 'Caller info',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Me' },
                },
              },
            },
            '401': {
              description: 'Missing or invalid API key',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/Error' } },
              },
            },
          },
        },
      },
      '/contacts': {
        get: {
          summary: 'List contacts (cursor paginated)',
          parameters: [
            {
              name: 'cursor',
              in: 'query',
              schema: { type: 'string' },
              description: 'Opaque pagination cursor returned by a previous call',
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
            },
          ],
          responses: {
            '200': {
              description: 'A page of contacts',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ContactsList' },
                },
              },
            },
            '401': { description: 'Missing or invalid API key' },
            '403': { description: 'Missing required scope' },
            '429': { description: 'Rate limit exceeded' },
          },
        },
        post: {
          summary: 'Create a contact',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ContactCreate' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Contact' },
                },
              },
            },
            '400': { description: 'Invalid payload' },
            '401': { description: 'Missing or invalid API key' },
            '403': { description: 'Missing required scope' },
            '429': { description: 'Rate limit exceeded' },
          },
        },
      },
    },
    'x-rate-limits': { ...TIER_LIMITS },
  };
}
