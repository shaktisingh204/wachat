'use client';

import { useCallback } from 'react';
import { LuLink } from 'react-icons/lu';
import type { Block } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass } from '../shared/primitives';

/* ── Types ───────────────────────────────────────────────────────────────── */

interface TypebotLinkOptions {
  /** ID or name of the target flow to jump to */
  flowId?: string;
  /** Optional: title of the group in the target flow to start at */
  groupTitle?: string;
}

/* ── Props ───────────────────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
};

/* ── Main component ──────────────────────────────────────────────────────── */

export function TypebotLinkSettings({ block, onBlockChange }: Props) {
  const opts = (block.options ?? {}) as TypebotLinkOptions;

  const update = useCallback(
    (patch: Partial<TypebotLinkOptions>) => {
      onBlockChange({ ...block, options: { ...opts, ...patch } });
    },
    [block, opts, onBlockChange],
  );

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuLink} title="Flow Link" />

      <Field label="Flow ID or name">
        <input
          type="text"
          value={opts.flowId ?? ''}
          onChange={(e) => update({ flowId: e.target.value })}
          placeholder="e.g. 64abc123…"
          className={inputClass}
        />
        <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
          Enter the flow ID to jump to. The user's session will continue inside the linked flow.
        </p>
      </Field>

      <Field label="Start at group (optional)">
        <input
          type="text"
          value={opts.groupTitle ?? ''}
          onChange={(e) => update({ groupTitle: e.target.value || undefined })}
          placeholder="Group title in the target flow"
          className={inputClass}
        />
        <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
          Leave blank to start at the default Start event of the linked flow.
        </p>
      </Field>
    </div>
  );
}
