'use client';

import { LuExternalLink, LuBraces } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { Field, inputClass, toggleClass, PanelHeader } from './shared/primitives';

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

export function RedirectSettings({ block, onBlockChange, variables: _variables = [] }: Props) {
  const options = block.options ?? {};
  const url = typeof options.url === 'string' ? options.url : '';
  const openInNewTab = Boolean(options.openInNewTab ?? true);

  const update = (patch: Record<string, unknown>) =>
    onBlockChange({ ...block, options: { ...options, ...patch } });

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuExternalLink} title="Redirect" />

      {/* URL input */}
      <Field label="URL">
        <div className="relative flex items-center">
          <input
            type="text"
            value={url}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="https://example.com or {{redirectUrl}}"
            className={cn(inputClass, 'pr-8')}
          />
          <LuBraces
            className="absolute right-2.5 h-3.5 w-3.5 text-[var(--gray-7)] pointer-events-none"
            strokeWidth={1.8}
          />
        </div>
        <p className="text-[11px] text-[var(--gray-8)] mt-1">
          Use{' '}
          <code className="font-mono bg-[var(--gray-3)] px-1 rounded text-[#f76808]">
            {'{{variable}}'}
          </code>{' '}
          to insert a dynamic URL.
        </p>
      </Field>

      {/* Open in new tab toggle */}
      <div className="flex items-center justify-between">
        <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
          Open in new tab
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={openInNewTab}
          onClick={() => update({ openInNewTab: !openInNewTab })}
          className={toggleClass(openInNewTab)}
        >
          <span
            className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${openInNewTab ? 'translate-x-5' : 'translate-x-0.5'}`}
          />
        </button>
      </div>
    </div>
  );
}
