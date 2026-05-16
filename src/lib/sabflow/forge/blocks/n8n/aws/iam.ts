/**
 * Forge block: AWS IAM
 *
 * Source: n8n-master/packages/nodes-base/nodes/Aws/IAM/AwsIam.node.ts
 *
 * Dynamic-imports `@aws-sdk/client-iam`.
 *
 * Actions: list-users, get-user, list-roles.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock, ForgeField } from '../../../types';
import { asNumber, asString } from '../_shared/http';
import { optionalImport } from '../_shared/optional_import';

type AwsCred = { accessKeyId: string; secretAccessKey: string; region: string };

function readCred(ctx: ForgeActionContext): AwsCred {
  const accessKeyId = asString(ctx.options.accessKeyId);
  const secretAccessKey = asString(ctx.options.secretAccessKey);
  const region = asString(ctx.options.region);
  if (!accessKeyId || !secretAccessKey || !region) {
    throw new Error('AWS IAM: accessKeyId, secretAccessKey and region are required');
  }
  return { accessKeyId, secretAccessKey, region };
}

type SdkClient = {
  send: (cmd: unknown) => Promise<Record<string, unknown>>;
  destroy?: () => void;
};

type IamSdk = Record<string, unknown> & {
  IAMClient: new (cfg: Record<string, unknown>) => SdkClient;
};

async function loadSdk(): Promise<IamSdk> {
  try {
    const mod = await optionalImport<Record<string, unknown>>('@aws-sdk/client-iam');
    const real = ((mod as { default?: Record<string, unknown> }).default ?? mod) as IamSdk;
    if (typeof real.IAMClient !== 'function') throw new Error('IAMClient missing');
    return real;
  } catch {
    throw new Error("AWS IAM: install '@aws-sdk/client-iam' to use this block");
  }
}

function clientFor(cred: AwsCred, sdk: IamSdk): SdkClient {
  return new sdk.IAMClient({
    region: cred.region,
    credentials: { accessKeyId: cred.accessKeyId, secretAccessKey: cred.secretAccessKey },
  });
}

async function runCommand(sdk: IamSdk, cmdName: string, input: Record<string, unknown>, cred: AwsCred): Promise<Record<string, unknown>> {
  const Ctor = sdk[cmdName] as undefined | (new (i: Record<string, unknown>) => unknown);
  if (typeof Ctor !== 'function') {
    throw new Error(`AWS IAM: ${cmdName} not available in SDK`);
  }
  const client = clientFor(cred, sdk);
  try {
    return await client.send(new Ctor(input));
  } finally {
    client.destroy?.();
  }
}

async function listUsers(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const PathPrefix = asString(ctx.options.pathPrefix) || undefined;
  const MaxItems = asNumber(ctx.options.maxItems);
  const Marker = asString(ctx.options.marker) || undefined;
  const input: Record<string, unknown> = {};
  if (PathPrefix) input.PathPrefix = PathPrefix;
  if (MaxItems !== undefined) input.MaxItems = MaxItems;
  if (Marker) input.Marker = Marker;
  const res = await runCommand(sdk, 'ListUsersCommand', input, cred);
  const users = (res.Users as unknown[] | undefined) ?? [];
  return {
    outputs: {
      users,
      isTruncated: res.IsTruncated ?? false,
      marker: res.Marker ?? null,
    },
    logs: [`IAM ListUsers → ${users.length} user(s)`],
  };
}

async function getUser(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const UserName = asString(ctx.options.userName) || undefined;
  const input: Record<string, unknown> = {};
  if (UserName) input.UserName = UserName;
  const res = await runCommand(sdk, 'GetUserCommand', input, cred);
  return {
    outputs: { user: res.User ?? null },
    logs: [`IAM GetUser ${UserName ?? '(self)'}`],
  };
}

async function listRoles(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const PathPrefix = asString(ctx.options.pathPrefix) || undefined;
  const MaxItems = asNumber(ctx.options.maxItems);
  const Marker = asString(ctx.options.marker) || undefined;
  const input: Record<string, unknown> = {};
  if (PathPrefix) input.PathPrefix = PathPrefix;
  if (MaxItems !== undefined) input.MaxItems = MaxItems;
  if (Marker) input.Marker = Marker;
  const res = await runCommand(sdk, 'ListRolesCommand', input, cred);
  const roles = (res.Roles as unknown[] | undefined) ?? [];
  return {
    outputs: {
      roles,
      isTruncated: res.IsTruncated ?? false,
      marker: res.Marker ?? null,
    },
    logs: [`IAM ListRoles → ${roles.length} role(s)`],
  };
}

const CRED_FIELDS: ForgeField[] = [
  { id: 'accessKeyId', label: 'Access key id', type: 'password', required: true },
  { id: 'secretAccessKey', label: 'Secret access key', type: 'password', required: true },
  { id: 'region', label: 'Region', type: 'text', required: true, placeholder: 'us-east-1' },
];

const block: ForgeBlock = {
  id: 'forge_aws_iam',
  name: 'AWS IAM',
  description: 'List and inspect IAM users and roles.',
  iconName: 'LuKey',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'list_users',
      label: 'List users',
      description: 'ListUsers in the account.',
      fields: [
        ...CRED_FIELDS,
        { id: 'pathPrefix', label: 'Path prefix', type: 'text' },
        { id: 'maxItems', label: 'Max items', type: 'number' },
        { id: 'marker', label: 'Marker (pagination)', type: 'text' },
      ],
      run: listUsers,
    },
    {
      id: 'get_user',
      label: 'Get user',
      description: 'GetUser — omit name to return the calling identity.',
      fields: [
        ...CRED_FIELDS,
        { id: 'userName', label: 'User name (optional)', type: 'text' },
      ],
      run: getUser,
    },
    {
      id: 'list_roles',
      label: 'List roles',
      description: 'ListRoles in the account.',
      fields: [
        ...CRED_FIELDS,
        { id: 'pathPrefix', label: 'Path prefix', type: 'text' },
        { id: 'maxItems', label: 'Max items', type: 'number' },
        { id: 'marker', label: 'Marker (pagination)', type: 'text' },
      ],
      run: listRoles,
    },
  ],
};

registerForgeBlock(block);
export default block;
