/**
 * Forge block: Time Saved
 *
 * Source: n8n-master/packages/nodes-base/nodes/TimeSaved/TimeSaved.node.ts
 *
 * Bookkeeping action — records how many minutes a step is estimated to save.
 * In SabFlow this is a soft metric: the action emits structured outputs that
 * flow authors can pipe into the audit log or a metrics sink. No persistent
 * storage is performed here.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString } from '../_shared/http';

async function markSaved(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const minutesSaved = Math.max(0, asNumber(ctx.options.durationMinutes) ?? 0);
  const note = asString(ctx.options.note);
  const recordedAt = new Date().toISOString();
  return {
    outputs: { minutesSaved, note, recordedAt },
    logs: [`TimeSaved mark_saved → ${minutesSaved}m (${note || 'no note'})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_time_saved',
  name: 'Time Saved',
  description: 'Record minutes saved by an automation step. Bookkeeping only — wire to audit log if needed.',
  iconName: 'LuClock',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'mark_saved',
      label: 'Mark time saved',
      description: 'Returns a structured record of minutes saved + note + ISO timestamp.',
      fields: [
        { id: 'durationMinutes', label: 'Duration (minutes)', type: 'number', required: true, defaultValue: 1 },
        { id: 'note', label: 'Note', type: 'text', placeholder: 'Replaced manual data entry' },
      ],
      run: markSaved,
    },
  ],
};

registerForgeBlock(block);
export default block;
