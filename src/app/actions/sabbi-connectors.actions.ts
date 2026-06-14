'use server';

/**
 * SabBI connectors — one-click "Connect <module>" that seeds a governed
 * semantic model over another SabNode module's collection. Idempotent: a second
 * connect returns the existing model rather than duplicating it.
 */

import { revalidatePath } from 'next/cache';

import { CONNECTORS, getConnector } from '@/lib/sabbi/connectors';

import { createModelAction, listModelsAction } from './sabbi-models.actions';

const CONNECTORS_PATH = '/dashboard/sabbi/connectors';

export async function seedConnectorAction(
  key: string,
): Promise<{ id: string; already: boolean }> {
  const def = getConnector(key);
  if (!def) throw new Error(`Unknown connector: ${key}`);

  const existing = await listModelsAction({ connector: key, limit: 1 });
  if (existing.items.length > 0) {
    return { id: existing.items[0]._id, already: true };
  }

  const res = await createModelAction(def.model);
  revalidatePath(CONNECTORS_PATH);
  revalidatePath('/dashboard/sabbi/models');
  return { id: res.id, already: false };
}

/** Map of connector key → seeded model id, for the connectors page. */
export async function listConnectedAction(): Promise<Record<string, string>> {
  const res = await listModelsAction({ limit: 200 });
  const out: Record<string, string> = {};
  for (const m of res.items) {
    if (m.connector) out[m.connector] = m._id;
  }
  // Only surface connectors we still ship.
  const known = new Set(CONNECTORS.map((c) => c.key));
  return Object.fromEntries(Object.entries(out).filter(([k]) => known.has(k)));
}
