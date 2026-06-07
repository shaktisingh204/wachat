'use client';

import { useCallback } from 'react';
import { Link } from 'lucide-react';

import { Field, Input } from '@/components/sabcrm/20ui';
import type { Block } from '@/lib/sabflow/types';

/* Types */

interface TypebotLinkOptions {
  /** ID or name of the target flow to jump to */
  flowId?: string;
  /** Optional: title of the group in the target flow to start at */
  groupTitle?: string;
}

/* Props */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
};

/* Main component */

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
      <div className="flex items-center gap-2 border-b border-[var(--st-border)] pb-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-accent)]">
          <Link size={16} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Flow Link
        </span>
      </div>

      <Field
        label="Flow ID or name"
        help="Enter the flow ID to jump to. The user's session will continue inside the linked flow."
      >
        <Input
          type="text"
          value={opts.flowId ?? ''}
          onChange={(e) => update({ flowId: e.target.value })}
          placeholder="e.g. 64abc123"
        />
      </Field>

      <Field
        label="Start at group (optional)"
        help="Leave blank to start at the default Start event of the linked flow."
      >
        <Input
          type="text"
          value={opts.groupTitle ?? ''}
          onChange={(e) => update({ groupTitle: e.target.value || undefined })}
          placeholder="Group title in the target flow"
        />
      </Field>
    </div>
  );
}
