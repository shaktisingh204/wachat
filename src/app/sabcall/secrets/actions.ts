'use server';

/**
 * SabCall secrets vault — a per-project registry of named secret *references*
 * (SIP passwords, provider API keys, tokens). It deliberately stores a
 * `vaultRef` (a key into SabVault / the deployment secret store), NOT the raw
 * value — trunks/credentials reference these by name via their `passwordRef`,
 * and the engine resolves the actual value out-of-band. Project-scoped by the
 * `userId` field, like the rest of SabCall.
 */

import { makeSabcallResource } from '@/lib/sabcall/resource-crud';

const resource = makeSabcallResource('sabcall_secrets', {
  searchFields: ['name', 'kind'],
  revalidate: '/sabcall/secrets',
  extraFilters: ['kind'],
});

export interface SecretDoc {
  _id: string;
  userId?: string;
  name: string;
  kind: 'sip_password' | 'api_key' | 'token' | 'other';
  /** Reference into SabVault / the deployment secret store (never the value). */
  vaultRef: string;
  note?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function listSecrets(
  params?: Record<string, unknown>,
): Promise<{ items: SecretDoc[]; page: number; limit: number; hasMore: boolean }> {
  return (await resource.list(params)) as unknown as {
    items: SecretDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export async function createSecret(
  input: Record<string, unknown>,
): Promise<{ id: string; entity: SecretDoc }> {
  return (await resource.create(input)) as unknown as { id: string; entity: SecretDoc };
}

export async function updateSecret(
  id: string,
  patch: Record<string, unknown>,
): Promise<SecretDoc | null> {
  return (await resource.update(id, patch)) as unknown as SecretDoc | null;
}

export async function deleteSecret(id: string): Promise<{ deleted: boolean }> {
  return resource.remove(id);
}
