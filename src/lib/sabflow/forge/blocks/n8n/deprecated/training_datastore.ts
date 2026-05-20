/**
 * Forge block: Customer Datastore (n8n training)
 *
 * Source: n8n-master/packages/nodes-base/nodes/N8nTrainingCustomerDatastore/N8nTrainingCustomerDatastore.node.ts
 *
 * n8n ships this as a demo/training node — an in-memory customer table
 * with no persistence. Ported here for migration parity only; for real
 * customer data use SabNode's CRM module or a database block.
 *
 * Operations covered:
 *   - set_customer(id, data)
 *   - get_customer(id)
 *   - list_customers()
 *
 * Limitations / deferred:
 *   - The store lives for the lifetime of a single action invocation only.
 *     `set_customer` does not persist beyond the returned outputs — it just
 *     echoes the upsert into the seed map. n8n's original node does the
 *     same (it's a teaching example).
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

type Customer = Record<string, unknown> & { id: string };

const SEED: Customer[] = [
  {
    id: '23423532',
    name: 'Jay Gatsby',
    email: 'gatsby@west-egg.com',
    notes: 'Keeps asking about a green light??',
    country: 'US',
    created: '1925-04-10',
  },
  {
    id: '23423533',
    name: 'José Arcadio Buendía',
    email: 'jab@macondo.co',
    notes: 'Lots of people named after him. Very confusing',
    country: 'CO',
    created: '1967-05-05',
  },
  {
    id: '23423534',
    name: 'Max Sendak',
    email: 'info@in-and-out-of-weeks.org',
    notes: 'Keeps rolling his terrible eyes',
    country: 'US',
    created: '1963-04-09',
  },
  {
    id: '23423535',
    name: 'Zaphod Beeblebrox',
    email: 'captain@heartofgold.com',
    notes: 'Felt like I was talking to more than one person',
    country: null,
    created: '1979-10-12',
  },
  {
    id: '23423536',
    name: 'Edmund Pevensie',
    email: 'edmund@narnia.gov',
    notes: 'Passionate sailor',
    country: 'UK',
    created: '1950-10-16',
  },
];

function snapshot(): Customer[] {
  return SEED.map((row) => ({ ...row }));
}

function parseData(raw: unknown): Record<string, unknown> {
  let value: unknown = raw;
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return {};
    try {
      value = JSON.parse(t);
    } catch (err) {
      throw new Error(`TrainingDatastore: data is not valid JSON — ${(err as Error).message}`);
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('TrainingDatastore: data must be an object');
  }
  return value as Record<string, unknown>;
}

async function setCustomer(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.id);
  if (!id) throw new Error('TrainingDatastore: id is required');
  const data = parseData(ctx.options.data);
  const list = snapshot();
  const idx = list.findIndex((c) => c.id === id);
  const next: Customer = { ...(idx >= 0 ? list[idx] : { id }), ...data, id };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  return {
    outputs: { customer: next, count: list.length },
    logs: [`TrainingDatastore set_customer → ${id}`],
  };
}

async function getCustomer(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.id);
  if (!id) throw new Error('TrainingDatastore: id is required');
  const found = snapshot().find((c) => c.id === id);
  if (!found) throw new Error(`TrainingDatastore: customer ${id} not found`);
  return {
    outputs: { customer: found },
    logs: [`TrainingDatastore get_customer → ${id}`],
  };
}

async function listCustomers(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const list = snapshot();
  return {
    outputs: { customers: list, count: list.length },
    logs: [`TrainingDatastore list_customers → ${list.length}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_training_datastore',
  name: 'Customer Datastore (Training Demo)',
  description: 'Demo in-memory customer table. No persistence — for migration parity only.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'set_customer',
      label: 'Set customer',
      description: 'Upsert a customer into the in-memory seed list and echo back the result.',
      fields: [
        { id: 'id', label: 'Customer ID', type: 'text', required: true },
        {
          id: 'data',
          label: 'Data',
          type: 'json',
          placeholder: '{"name":"Ada","email":"ada@example.com"}',
          helperText: 'Object merged onto the existing row (if any). `id` is always preserved.',
        },
      ],
      run: setCustomer,
    },
    {
      id: 'get_customer',
      label: 'Get customer',
      description: 'Fetch one customer from the in-memory seed list by id.',
      fields: [{ id: 'id', label: 'Customer ID', type: 'text', required: true }],
      run: getCustomer,
    },
    {
      id: 'list_customers',
      label: 'List customers',
      description: 'Return the full in-memory seed list.',
      fields: [],
      run: listCustomers,
    },
  ],
};

registerForgeBlock(block);
export default block;
