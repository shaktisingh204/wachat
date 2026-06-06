import { cn } from '@/components/sabcrm/20ui/compat';
/**
 * Forge block: LDAP
 *
 * Source: n8n-master/packages/nodes-base/nodes/Ldap/Ldap.node.ts
 *
 * Uses `ldapjs`. All operations open a client, bind, run the op, then unbind.
 * Bind DN + password are inline credential fields.
 *
 * Operations covered:
 *   - bind        Verify credentials against the directory
 *   - search      Run an LDAP search filter + return matched entries
 *   - compare     Compare an attribute value on a DN
 */

/// <reference path="../../../../../../types/forge-drivers.d.ts" />
import type { LdapClient } from 'ldapjs';
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString } from '../_shared/http';

async function ldapCreateClient(opts: Record<string, unknown>): Promise<LdapClient> {
  const mod = (await import('ldapjs')) as unknown as {
    default?: { createClient: (opts: Record<string, unknown>) => LdapClient };
    createClient?: (opts: Record<string, unknown>) => LdapClient;
  };
  const createFn = mod.default?.createClient ?? mod.createClient;
  if (!createFn) throw new Error('LDAP: failed to load ldapjs driver');
  return createFn(opts);
}

async function withClient<T>(
  ctx: ForgeActionContext,
  fn: (client: LdapClient) => Promise<T>,
): Promise<T> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('LDAP: url is required (e.g. ldap://host:389)');
  const bindDN = asString(ctx.options.bindDN);
  const bindPassword = asString(ctx.options.bindPassword);
  const client = await ldapCreateClient({ url });
  try {
    if (bindDN) {
      await new Promise<void>((resolve, reject) => {
        client.bind(bindDN, bindPassword, (err) => (err ? reject(err) : resolve()));
      });
    }
    return await fn(client);
  } finally {
    await new Promise<void>((resolve) => client.unbind(() => resolve()));
  }
}

async function bind(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('LDAP: url is required');
  const dn = asString(ctx.options.bindDN);
  if (!dn) throw new Error('LDAP: bindDN is required');
  const password = asString(ctx.options.bindPassword);
  const client = await ldapCreateClient({ url });
  try {
    await new Promise<void>((resolve, reject) => {
      client.bind(dn, password, (err) => (err ? reject(err) : resolve()));
    });
    return { outputs: { ok: true, dn }, logs: [`LDAP bind → ${dn}`] };
  } finally {
    await new Promise<void>((resolve) => client.unbind(() => resolve()));
  }
}

async function search(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const base = asString(ctx.options.base);
  if (!base) throw new Error('LDAP: base is required');
  const filter = asString(ctx.options.filter) || '(objectClass=*)';
  const scope = asString(ctx.options.scope) || 'sub';
  const sizeLimit = asNumber(ctx.options.sizeLimit) ?? 100;
  const attributes = asString(ctx.options.attributes)
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  return withClient(ctx, async (client) => {
    const entries: unknown[] = [];
    await new Promise<void>((resolve, reject) => {
      client.search(
        base,
        {
          filter,
          scope,
          sizeLimit,
          attributes: attributes.length ? attributes : undefined,
        },
        (err, res) => {
          if (err) return reject(err);
          res.on('searchEntry', (entry) => {
            const obj = entry.object ?? entry.pojo ?? entry;
            entries.push(obj);
          });
          res.on('error', (e) => reject(e));
          res.on('end', () => resolve());
        },
      );
    });
    return {
      outputs: { entries, count: entries.length },
      logs: [`LDAP search → ${entries.length} entries (base=${base}, filter=${filter})`],
    };
  });
}

async function compare(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const dn = asString(ctx.options.dn);
  if (!dn) throw new Error('LDAP: dn is required');
  const attribute = asString(ctx.options.attribute);
  if (!attribute) throw new Error('LDAP: attribute is required');
  const value = asString(ctx.options.value);
  return withClient(ctx, async (client) => {
    const matched = await new Promise<boolean>((resolve, reject) => {
      client.compare(dn, attribute, value, (err, m) => (err ? reject(err) : resolve(m)));
    });
    return { outputs: { matched }, logs: [`LDAP compare → ${dn}/${attribute} = ${matched}`] };
  });
}

const CRED_FIELDS = [
  { id: 'url', label: 'URL', type: 'text' as const, required: true, placeholder: 'ldap://ldap.example.com:389' },
  { id: 'bindDN', label: 'Bind DN', type: 'text' as const, placeholder: 'cn=admin,dc=example,dc=com' },
  { id: 'bindPassword', label: 'Bind password', type: 'password' as const },
];

const SCOPE_OPTIONS = [
  { label: 'Base', value: 'base' },
  { label: 'One level', value: 'one' },
  { label: 'Subtree', value: 'sub' },
];

const block: ForgeBlock = {
  id: 'forge_ldap',
  name: 'LDAP',
  description: 'Bind, search and compare against an LDAP directory via ldapjs.',
  iconName: 'LuUsers',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'bind',
      label: 'Bind',
      description: 'Authenticate a DN/password pair.',
      fields: [
        { id: 'url', label: 'URL', type: 'text', required: true, placeholder: 'ldap://ldap.example.com:389' },
        { id: 'bindDN', label: 'Bind DN', type: 'text', required: true },
        { id: 'bindPassword', label: 'Bind password', type: 'password', required: true },
      ],
      run: bind,
    },
    {
      id: 'search',
      label: 'Search',
      description: 'Run an LDAP search and return entries.',
      fields: [
        ...CRED_FIELDS,
        { id: 'base', label: 'Search base', type: 'text', required: true, placeholder: 'dc=example,dc=com' },
        { id: 'filter', label: 'Filter', type: 'text', defaultValue: '(objectClass=*)' },
        { id: 'scope', label: 'Scope', type: 'select', options: SCOPE_OPTIONS, defaultValue: 'sub' },
        { id: 'attributes', label: 'Attributes (CSV)', type: 'text', placeholder: 'cn,mail' },
        { id: 'sizeLimit', label: 'Size limit', type: 'number', defaultValue: 100 },
      ],
      run: search,
    },
    {
      id: 'compare',
      label: 'Compare attribute',
      description: 'Compare an attribute on a DN against a value.',
      fields: [
        ...CRED_FIELDS,
        { id: 'dn', label: 'DN', type: 'text', required: true },
        { id: 'attribute', label: 'Attribute', type: 'text', required: true },
        { id: 'value', label: 'Value', type: 'text', required: true },
      ],
      run: compare,
    },
  ],
};

registerForgeBlock(block);
export default block;
