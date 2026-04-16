'use client';

import { LuCornerRightDown } from 'react-icons/lu';
import type { Block, Group, Variable } from '@/lib/sabflow/types';
import { Field, inputClass, selectClass, PanelHeader } from './shared/primitives';

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  /** All groups in the current flow — used to populate the target selector */
  groups?: Group[];
  variables?: Variable[];
};

export function JumpSettings({ block, onBlockChange, groups = [], variables: _variables = [] }: Props) {
  const options = block.options ?? {};
  const targetGroupId = typeof options.targetGroupId === 'string' ? options.targetGroupId : '';
  const blockLabel = typeof options.blockLabel === 'string' ? options.blockLabel : '';

  const update = (patch: Record<string, unknown>) =>
    onBlockChange({ ...block, options: { ...options, ...patch } });

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuCornerRightDown} title="Jump" />

      {/* Target group dropdown */}
      <Field label="Jump to group">
        {groups.length > 0 ? (
          <select
            value={targetGroupId}
            onChange={(e) => update({ targetGroupId: e.target.value })}
            className={selectClass}
          >
            <option value="">— select a group —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title || `Group ${g.id.slice(0, 6)}`}
              </option>
            ))}
          </select>
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--gray-6)] px-3 py-2.5 text-[12px] text-[var(--gray-8)]">
            No groups available in this flow yet.
          </div>
        )}
      </Field>

      {/* Optional block label / note */}
      <Field label="Block label (optional)">
        <input
          type="text"
          value={blockLabel}
          onChange={(e) => update({ blockLabel: e.target.value })}
          placeholder="Describe the jump destination…"
          className={inputClass}
        />
      </Field>

      <p className="text-[11px] text-[var(--gray-8)] leading-relaxed">
        Execution jumps to the start of the selected group.
        Use this to create loops or shortcuts in your flow.
      </p>
    </div>
  );
}
