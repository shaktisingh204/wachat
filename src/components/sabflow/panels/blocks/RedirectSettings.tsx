'use client';

import { ExternalLink, Braces } from 'lucide-react';
import type { Block, Variable } from '@/lib/sabflow/types';
import { Field, Input, Switch } from '@/components/sabcrm/20ui';
import { PanelHeader } from './shared/primitives';

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
      <PanelHeader icon={ExternalLink} title="Redirect" />

      {/* URL input */}
      <Field
        label="URL"
        help={
          <>
            Use{' '}
            <code className="rounded bg-[var(--st-bg-secondary)] px-1 font-mono text-[var(--st-text)]">
              {'{{variable}}'}
            </code>{' '}
            to insert a dynamic URL.
          </>
        }
      >
        <Input
          type="text"
          value={url}
          onChange={(e) => update({ url: e.target.value })}
          placeholder="https://example.com or {{redirectUrl}}"
          iconRight={Braces}
        />
      </Field>

      {/* Open in new tab toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
          Open in new tab
        </span>
        <Switch
          checked={openInNewTab}
          onCheckedChange={(next) => update({ openInNewTab: next })}
          aria-label="Open redirect in a new tab"
        />
      </div>
    </div>
  );
}
