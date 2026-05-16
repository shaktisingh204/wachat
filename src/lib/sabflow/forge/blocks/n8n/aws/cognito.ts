/**
 * Forge block: AWS Cognito Identity Provider
 *
 * Source: n8n-master/packages/nodes-base/nodes/Aws/Cognito/AwsCognito.node.ts
 *
 * Dynamic-imports `@aws-sdk/client-cognito-identity-provider`.
 *
 * Actions: admin-create-user, admin-get-user, list-users.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock, ForgeField } from '../../../types';
import { asNumber, asString } from '../_shared/http';

type AwsCred = { accessKeyId: string; secretAccessKey: string; region: string };

function readCred(ctx: ForgeActionContext): AwsCred {
  const accessKeyId = asString(ctx.options.accessKeyId);
  const secretAccessKey = asString(ctx.options.secretAccessKey);
  const region = asString(ctx.options.region);
  if (!accessKeyId || !secretAccessKey || !region) {
    throw new Error('AWS Cognito: accessKeyId, secretAccessKey and region are required');
  }
  return { accessKeyId, secretAccessKey, region };
}

type SdkClient = {
  send: (cmd: unknown) => Promise<Record<string, unknown>>;
  destroy?: () => void;
};

type CognitoSdk = Record<string, unknown> & {
  CognitoIdentityProviderClient: new (cfg: Record<string, unknown>) => SdkClient;
};

async function loadSdk(): Promise<CognitoSdk> {
  try {
    const mod = (await import('@aws-sdk/client-cognito-identity-provider' as string)) as Record<string, unknown>;
    const real = ((mod as { default?: Record<string, unknown> }).default ?? mod) as CognitoSdk;
    if (typeof real.CognitoIdentityProviderClient !== 'function') throw new Error('CognitoIdentityProviderClient missing');
    return real;
  } catch {
    throw new Error("AWS Cognito: install '@aws-sdk/client-cognito-identity-provider' to use this block");
  }
}

function clientFor(cred: AwsCred, sdk: CognitoSdk): SdkClient {
  return new sdk.CognitoIdentityProviderClient({
    region: cred.region,
    credentials: { accessKeyId: cred.accessKeyId, secretAccessKey: cred.secretAccessKey },
  });
}

async function runCommand(sdk: CognitoSdk, cmdName: string, input: Record<string, unknown>, cred: AwsCred): Promise<Record<string, unknown>> {
  const Ctor = sdk[cmdName] as undefined | (new (i: Record<string, unknown>) => unknown);
  if (typeof Ctor !== 'function') {
    throw new Error(`AWS Cognito: ${cmdName} not available in SDK`);
  }
  const client = clientFor(cred, sdk);
  try {
    return await client.send(new Ctor(input));
  } finally {
    client.destroy?.();
  }
}

function parseAttributes(raw: unknown): { Name: string; Value: string }[] {
  const s = asString(raw).trim();
  if (!s) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(s);
  } catch (err) {
    throw new Error(`AWS Cognito: userAttributes is not valid JSON — ${(err as Error).message}`);
  }
  if (Array.isArray(parsed)) {
    return parsed.map((entry) => {
      const e = entry as Record<string, unknown>;
      return { Name: asString(e.Name ?? e.name), Value: asString(e.Value ?? e.value) };
    });
  }
  if (parsed && typeof parsed === 'object') {
    return Object.entries(parsed as Record<string, unknown>).map(([Name, Value]) => ({
      Name,
      Value: asString(Value),
    }));
  }
  throw new Error('AWS Cognito: userAttributes must be a JSON array of {Name,Value} or an object map');
}

async function adminCreateUser(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const UserPoolId = asString(ctx.options.userPoolId);
  const Username = asString(ctx.options.username);
  if (!UserPoolId) throw new Error('AWS Cognito: userPoolId is required');
  if (!Username) throw new Error('AWS Cognito: username is required');
  const TemporaryPassword = asString(ctx.options.temporaryPassword) || undefined;
  const UserAttributes = parseAttributes(ctx.options.userAttributes);
  const MessageAction = asString(ctx.options.messageAction) || undefined;
  const input: Record<string, unknown> = { UserPoolId, Username };
  if (TemporaryPassword) input.TemporaryPassword = TemporaryPassword;
  if (UserAttributes.length) input.UserAttributes = UserAttributes;
  if (MessageAction) input.MessageAction = MessageAction;
  const res = await runCommand(sdk, 'AdminCreateUserCommand', input, cred);
  return {
    outputs: { user: res.User ?? null },
    logs: [`Cognito AdminCreateUser ${UserPoolId}/${Username}`],
  };
}

async function adminGetUser(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const UserPoolId = asString(ctx.options.userPoolId);
  const Username = asString(ctx.options.username);
  if (!UserPoolId) throw new Error('AWS Cognito: userPoolId is required');
  if (!Username) throw new Error('AWS Cognito: username is required');
  const res = await runCommand(sdk, 'AdminGetUserCommand', { UserPoolId, Username }, cred);
  return {
    outputs: {
      username: res.Username ?? null,
      userStatus: res.UserStatus ?? null,
      enabled: res.Enabled ?? null,
      userAttributes: res.UserAttributes ?? [],
      userCreateDate: res.UserCreateDate ?? null,
      userLastModifiedDate: res.UserLastModifiedDate ?? null,
    },
    logs: [`Cognito AdminGetUser ${UserPoolId}/${Username}`],
  };
}

async function listUsers(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const UserPoolId = asString(ctx.options.userPoolId);
  if (!UserPoolId) throw new Error('AWS Cognito: userPoolId is required');
  const Limit = asNumber(ctx.options.limit) ?? 60;
  const Filter = asString(ctx.options.filter) || undefined;
  const PaginationToken = asString(ctx.options.paginationToken) || undefined;
  const input: Record<string, unknown> = { UserPoolId, Limit };
  if (Filter) input.Filter = Filter;
  if (PaginationToken) input.PaginationToken = PaginationToken;
  const res = await runCommand(sdk, 'ListUsersCommand', input, cred);
  const users = (res.Users as unknown[] | undefined) ?? [];
  return {
    outputs: { users, count: users.length, paginationToken: res.PaginationToken ?? null },
    logs: [`Cognito ListUsers ${UserPoolId} → ${users.length} user(s)`],
  };
}

const CRED_FIELDS: ForgeField[] = [
  { id: 'accessKeyId', label: 'Access key id', type: 'password', required: true },
  { id: 'secretAccessKey', label: 'Secret access key', type: 'password', required: true },
  { id: 'region', label: 'Region', type: 'text', required: true, placeholder: 'us-east-1' },
];

const block: ForgeBlock = {
  id: 'forge_aws_cognito',
  name: 'AWS Cognito',
  description: 'Manage Cognito user pools (admin create / get / list).',
  iconName: 'LuUsers',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'admin_create_user',
      label: 'Admin create user',
      description: 'AdminCreateUser in a user pool.',
      fields: [
        ...CRED_FIELDS,
        { id: 'userPoolId', label: 'User pool id', type: 'text', required: true },
        { id: 'username', label: 'Username', type: 'text', required: true },
        { id: 'temporaryPassword', label: 'Temporary password', type: 'password' },
        { id: 'userAttributes', label: 'User attributes (JSON)', type: 'json', placeholder: '[{"Name":"email","Value":"a@b.c"}]' },
        {
          id: 'messageAction',
          label: 'Message action',
          type: 'select',
          options: [
            { label: 'Default (send invitation)', value: '' },
            { label: 'RESEND', value: 'RESEND' },
            { label: 'SUPPRESS', value: 'SUPPRESS' },
          ],
        },
      ],
      run: adminCreateUser,
    },
    {
      id: 'admin_get_user',
      label: 'Admin get user',
      description: 'AdminGetUser by username.',
      fields: [
        ...CRED_FIELDS,
        { id: 'userPoolId', label: 'User pool id', type: 'text', required: true },
        { id: 'username', label: 'Username', type: 'text', required: true },
      ],
      run: adminGetUser,
    },
    {
      id: 'list_users',
      label: 'List users',
      description: 'ListUsers in a user pool.',
      fields: [
        ...CRED_FIELDS,
        { id: 'userPoolId', label: 'User pool id', type: 'text', required: true },
        { id: 'filter', label: 'Filter', type: 'text', placeholder: 'email ^= "a@"' },
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: 60 },
        { id: 'paginationToken', label: 'Pagination token', type: 'text' },
      ],
      run: listUsers,
    },
  ],
};

registerForgeBlock(block);
export default block;
