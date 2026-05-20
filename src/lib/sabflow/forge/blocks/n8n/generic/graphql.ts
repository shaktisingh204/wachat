/**
 * Forge block: GraphQL
 *
 * Source: n8n-master/packages/nodes-base/nodes/GraphQL/GraphQL.node.ts
 * Credential type: 'http_header_auth' (optional) — when set, the credential's
 *   { name, value } pair is merged into the request headers (typical use:
 *   Authorization: Bearer <token>).
 *
 * Operations covered:
 *   - request — POST a GraphQL query (and optional variables) to an endpoint
 *   - requestGet — GET a GraphQL query with `query` + URL-encoded `variables`
 *
 * Out of scope: OAuth1/2 credentials, digest auth, file-upload mutations.
 * For non-header auth, use the HTTP Request block.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
  ForgeKeyValuePair,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function collectHeaders(ctx: ForgeActionContext): Record<string, string> {
  const headers: Record<string, string> = {};
  const raw = ctx.options.headers as ForgeKeyValuePair[] | undefined;
  if (Array.isArray(raw)) {
    for (const pair of raw) {
      if (!pair?.key) continue;
      headers[pair.key] = asString(pair.value);
    }
  }
  const cred = ctx.credential;
  if (cred) {
    const name = asString(cred.name);
    const value = asString(cred.value);
    if (name && value) headers[name] = value;
  }
  return headers;
}

function parseVariables(raw: unknown): Record<string, unknown> | undefined {
  const s = asString(raw).trim();
  if (!s) return undefined;
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    throw new Error('variables must be a JSON object');
  } catch (err) {
    throw new Error(`GraphQL: invalid variables — ${(err as Error).message}`);
  }
}

async function requestGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const endpoint = asString(ctx.options.endpoint);
  const query = asString(ctx.options.query);
  if (!endpoint) throw new Error('GraphQL: endpoint is required');
  if (!query) throw new Error('GraphQL: query is required');

  const variables = parseVariables(ctx.options.variables);
  const headers = collectHeaders(ctx);

  // n8n's GET handler URL-encodes query + JSON-encoded variables into the
  // querystring, which matches the GraphQL HTTP transport spec.
  const url = new URL(endpoint);
  url.searchParams.set('query', query);
  if (variables) url.searchParams.set('variables', JSON.stringify(variables));

  const res = await apiRequest({
    service: 'GraphQL',
    method: 'GET',
    url: url.toString(),
    headers,
  });

  const body = res.data as { data?: unknown; errors?: Array<{ message: string }> } | unknown;
  if (body && typeof body === 'object' && Array.isArray((body as { errors?: unknown[] }).errors)) {
    const errs = (body as { errors: Array<{ message: string }> }).errors;
    if (errs.length) {
      throw new Error(`GraphQL: ${errs.map((e) => e.message).join('; ')}`);
    }
  }
  const data = (body as { data?: unknown })?.data ?? body;
  return {
    outputs: { data, status: res.status },
    logs: [`GraphQL GET ${endpoint} → ${res.status}`],
  };
}

async function request(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const endpoint = asString(ctx.options.endpoint);
  const query = asString(ctx.options.query);
  if (!endpoint) throw new Error('GraphQL: endpoint is required');
  if (!query) throw new Error('GraphQL: query is required');

  const variables = parseVariables(ctx.options.variables);
  const headers = collectHeaders(ctx);

  const res = await apiRequest({
    service: 'GraphQL',
    method: 'POST',
    url: endpoint,
    headers,
    json: { query, variables },
  });

  const body = res.data as { data?: unknown; errors?: Array<{ message: string }> } | unknown;
  if (body && typeof body === 'object' && Array.isArray((body as { errors?: unknown[] }).errors)) {
    const errs = (body as { errors: Array<{ message: string }> }).errors;
    if (errs.length) {
      throw new Error(`GraphQL: ${errs.map((e) => e.message).join('; ')}`);
    }
  }

  const data = (body as { data?: unknown })?.data ?? body;
  return {
    outputs: { data, status: res.status },
    logs: [`GraphQL POST ${endpoint} → ${res.status}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_graphql',
  name: 'GraphQL',
  description: 'Send a GraphQL query (with variables) to any endpoint.',
  iconName: 'LuShare2',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'http_header_auth',
  },
  actions: [
    {
      id: 'request',
      label: 'Send query',
      description: 'POST a GraphQL query. Pick an HTTP Header Auth credential for bearer-style auth.',
      fields: [
        {
          id: 'endpoint',
          label: 'Endpoint',
          type: 'text',
          required: true,
          placeholder: 'https://api.example.com/graphql',
        },
        {
          id: 'query',
          label: 'Query',
          type: 'textarea',
          required: true,
          placeholder: 'query Things($id: ID!) { thing(id: $id) { id name } }',
        },
        {
          id: 'variables',
          label: 'Variables (JSON)',
          type: 'json',
          placeholder: '{ "id": "abc" }',
        },
        {
          id: 'headers',
          label: 'Extra headers',
          type: 'key-value-list',
          helperText: 'Merged with the credential header (if any).',
        },
      ],
      run: request,
    },
    {
      id: 'request_get',
      label: 'Send query (GET)',
      description: 'Issue a GraphQL GET request — query/variables are URL-encoded.',
      fields: [
        {
          id: 'endpoint',
          label: 'Endpoint',
          type: 'text',
          required: true,
          placeholder: 'https://api.example.com/graphql',
        },
        {
          id: 'query',
          label: 'Query',
          type: 'textarea',
          required: true,
        },
        {
          id: 'variables',
          label: 'Variables (JSON)',
          type: 'json',
        },
        {
          id: 'headers',
          label: 'Extra headers',
          type: 'key-value-list',
          helperText: 'Merged with the credential header (if any).',
        },
      ],
      run: requestGet,
    },
  ],
};

registerForgeBlock(block);
export default block;
