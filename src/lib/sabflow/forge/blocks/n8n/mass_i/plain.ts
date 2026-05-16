/**
 * Forge block: Plain (support platform)
 *
 * API: https://www.plain.com/docs/api-reference/graphql/introduction
 * Auth: `Authorization: Bearer <api_key>`.
 *
 * Operations covered (GraphQL):
 *   - customer.upsert
 *   - customer.byEmail
 *   - thread.create
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://core-api.uk.plain.com/graphql/v1';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.apiKey);
  if (!key) throw new Error('Plain: apiKey is required');
  return { Authorization: `Bearer ${key}` };
}

async function gql<T = unknown>(
  ctx: ForgeActionContext,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await apiRequest({
    service: 'Plain',
    method: 'POST',
    url: API,
    headers: authHeader(ctx),
    json: { query, variables },
  });
  const data = res.data as { data?: T; errors?: Array<{ message: string }> };
  if (data?.errors?.length) throw new Error(`Plain: ${data.errors.map((e) => e.message).join('; ')}`);
  return data?.data as T;
}

async function customerUpsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  const fullName = asString(ctx.options.fullName);
  if (!email) throw new Error('Plain: email is required');
  const query = `mutation Upsert($i: UpsertCustomerInput!) {
    upsertCustomer(input: $i) { customer { id email { email } fullName } result }
  }`;
  const variables = {
    i: {
      identifier: { emailAddress: email },
      onCreate: { fullName, email: { email, isVerified: false } },
      onUpdate: { fullName: { value: fullName } },
    },
  };
  const data = await gql<{ upsertCustomer: unknown }>(ctx, query, variables);
  return { outputs: { result: data?.upsertCustomer }, logs: [`Plain customer upsert → ${email}`] };
}

async function customerByEmail(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Plain: email is required');
  const query = `query ByEmail($e: String!) {
    customerByEmail(email: $e) { id email { email } fullName }
  }`;
  const data = await gql<{ customerByEmail: unknown }>(ctx, query, { e: email });
  return { outputs: { customer: data?.customerByEmail }, logs: [`Plain customer byEmail → ${email}`] };
}

async function threadCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const customerId = asString(ctx.options.customerId);
  const title = asString(ctx.options.title);
  const body = asString(ctx.options.body);
  if (!customerId || !title) throw new Error('Plain: customerId and title are required');
  const query = `mutation Create($i: CreateThreadInput!) {
    createThread(input: $i) { thread { id title } }
  }`;
  const variables = {
    i: {
      customerIdentifier: { customerId },
      title,
      components: body ? [{ componentText: { text: body } }] : [],
    },
  };
  const data = await gql<{ createThread: unknown }>(ctx, query, variables);
  return { outputs: { thread: data?.createThread }, logs: [`Plain thread create → ${title}`] };
}

const block: ForgeBlock = {
  id: 'forge_plain',
  name: 'Plain',
  description: 'Plain support — customers and threads via GraphQL.',
  iconName: 'LuMessageCircle',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'customer_upsert',
      label: 'Upsert customer',
      description: 'Create or update a customer by email.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'fullName', label: 'Full name', type: 'text' },
      ],
      run: customerUpsert,
    },
    {
      id: 'customer_by_email',
      label: 'Find customer by email',
      description: 'Look up a Plain customer.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
      ],
      run: customerByEmail,
    },
    {
      id: 'thread_create',
      label: 'Create thread',
      description: 'Create a thread for a customer.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'customerId', label: 'Customer ID', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'body', label: 'Body', type: 'textarea' },
      ],
      run: threadCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
