/**
 * Forge block: Cron (port of n8n Cron trigger as a one-shot action)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Cron/Cron.node.ts
 *
 * Note: n8n's runtime trigger semantics don't apply here — this port is for
 * catalog parity. See src/lib/sabflow/triggers/ for SabFlow's real cron/
 * scheduling implementation. This action just previews the next N firing
 * timestamps for a given cron expression by walking forward minute-by-minute.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString } from '../_shared/http';

type CronFieldSpec = {
  min: number;
  max: number;
};

const FIELD_SPECS: CronFieldSpec[] = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day-of-month
  { min: 1, max: 12 }, // month
  { min: 0, max: 6 }, // day-of-week (0 = Sunday)
];

function parseField(raw: string, spec: CronFieldSpec): Set<number> {
  const values = new Set<number>();
  const parts = raw.split(',');
  for (const part of parts) {
    const [rangeStr, stepStr] = part.split('/');
    const step = stepStr ? Number.parseInt(stepStr, 10) : 1;
    if (!Number.isFinite(step) || step <= 0) {
      throw new Error(`Cron: invalid step in field "${raw}"`);
    }
    let lo = spec.min;
    let hi = spec.max;
    if (rangeStr !== '*') {
      if (rangeStr.includes('-')) {
        const [a, b] = rangeStr.split('-');
        lo = Number.parseInt(a, 10);
        hi = Number.parseInt(b, 10);
      } else {
        lo = hi = Number.parseInt(rangeStr, 10);
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo < spec.min || hi > spec.max || lo > hi) {
      throw new Error(`Cron: out-of-range field "${raw}"`);
    }
    for (let v = lo; v <= hi; v += step) values.add(v);
  }
  return values;
}

function matches(date: Date, fields: Set<number>[]): boolean {
  return (
    fields[0].has(date.getUTCMinutes()) &&
    fields[1].has(date.getUTCHours()) &&
    fields[2].has(date.getUTCDate()) &&
    fields[3].has(date.getUTCMonth() + 1) &&
    fields[4].has(date.getUTCDay())
  );
}

async function nextFires(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const expression = asString(ctx.options.expression).trim();
  if (!expression) throw new Error('Cron: expression is required (e.g. "*/5 * * * *")');
  const tokens = expression.split(/\s+/);
  if (tokens.length !== 5) {
    throw new Error(`Cron: expression must have 5 fields (minute hour day month dow), got ${tokens.length}`);
  }
  const fields = tokens.map((tok, i) => parseField(tok, FIELD_SPECS[i]));

  const count = Math.min(Math.max(asNumber(ctx.options.count) ?? 5, 1), 100);
  const horizonHours = Math.min(Math.max(asNumber(ctx.options.horizonHours) ?? 168, 1), 24 * 365);

  const start = new Date();
  start.setUTCSeconds(0, 0);
  start.setUTCMinutes(start.getUTCMinutes() + 1);

  const limitMs = start.getTime() + horizonHours * 60 * 60 * 1000;
  const fires: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= limitMs && fires.length < count) {
    if (matches(cursor, fields)) fires.push(cursor.toISOString());
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }

  return {
    outputs: { fires, count: fires.length, expression },
    logs: [`Cron next_fires → ${fires.length} occurrences within ${horizonHours}h`],
  };
}

const block: ForgeBlock = {
  id: 'forge_cron_n8n',
  name: 'Cron',
  description: 'Preview upcoming firing times for a cron expression. SabFlow real cron lives in the trigger system.',
  iconName: 'LuClock',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'next_fires',
      label: 'Next fires',
      description: 'Return the next N firing timestamps (UTC) for the given cron expression.',
      fields: [
        {
          id: 'expression',
          label: 'Cron expression',
          type: 'text',
          required: true,
          placeholder: '*/5 * * * *',
          helperText: 'Five fields: minute hour day-of-month month day-of-week (UTC).',
        },
        {
          id: 'count',
          label: 'Count (1-100)',
          type: 'number',
          defaultValue: 5,
        },
        {
          id: 'horizonHours',
          label: 'Horizon (hours)',
          type: 'number',
          defaultValue: 168,
          helperText: 'How far ahead to search for matches.',
        },
      ],
      run: nextFires,
    },
  ],
};

registerForgeBlock(block);
export default block;
