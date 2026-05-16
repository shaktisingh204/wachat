/**
 * Forge block: Schedule Trigger (info-only)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Schedule/ScheduleTrigger.node.ts
 *
 * IMPORTANT: SabFlow's real scheduling lives in `src/lib/sabflow/triggers/`.
 * This block is an info-only port that exposes the catalogue of supported
 * schedule modes so flow authors can introspect what's available without
 * leaving the editor. It does NOT register a cron.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

const SUPPORTED_MODES = [
  {
    id: 'cron',
    label: 'Cron expression',
    description: 'Five-field cron (minute hour day month dow) evaluated in UTC.',
    example: '*/15 * * * *',
  },
  {
    id: 'interval',
    label: 'Fixed interval',
    description: 'Every N seconds / minutes / hours / days starting from the flow activation time.',
    example: 'every 30m',
  },
  {
    id: 'fixed_times',
    label: 'Fixed times of day',
    description: 'Run at one or more wall-clock times (HH:MM) on selected weekdays.',
    example: '09:00, 17:00 on Mon-Fri',
  },
];

async function describe(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return {
    outputs: {
      modes: SUPPORTED_MODES,
      note: 'SabFlow scheduling is configured in src/lib/sabflow/triggers/, not from this block.',
    },
    logs: [`ScheduleTrigger describe → ${SUPPORTED_MODES.length} modes`],
  };
}

const block: ForgeBlock = {
  id: 'forge_schedule_trigger',
  name: 'Schedule Trigger',
  description: 'Info-only: lists the schedule modes that SabFlow triggers support.',
  iconName: 'LuCalendarClock',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'describe_modes',
      label: 'Describe supported modes',
      description: 'Return the catalogue of schedule modes (cron / interval / fixed times).',
      fields: [],
      run: describe,
    },
  ],
};

registerForgeBlock(block);
export default block;
