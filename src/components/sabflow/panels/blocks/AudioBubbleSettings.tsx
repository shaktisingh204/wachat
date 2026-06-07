'use client';

import { useCallback, useState } from 'react';
import { Mic, Link as LinkIcon, Music, Upload } from 'lucide-react';
import type { Block } from '@/lib/sabflow/types';
import {
  cn,
  Card,
  Field,
  Input,
  SegmentedControl,
} from '@/components/sabcrm/20ui';
import { FileUploadInput } from './shared/FileUploadInput';

/* Audio preview */
function AudioPreview({ url }: { url: string }) {
  if (!url || /^{{.*}}$/.test(url)) return null;

  return (
    <Card variant="outlined" padding="sm">
      <div className="mb-2 flex items-center gap-2 text-[var(--st-text-tertiary)]">
        <Music className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <span className="truncate text-[11px]">{url.split('/').pop() ?? 'Audio file'}</span>
      </div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        key={url}
        src={url}
        controls
        className="h-8 w-full accent-[var(--st-accent)]"
      />
    </Card>
  );
}

/* Tab values */
type Tab = 'upload' | 'url';

const TAB_ITEMS = [
  { value: 'upload' as const, label: 'Upload', icon: Upload },
  { value: 'url' as const, label: 'URL', icon: LinkIcon },
];

/* Main component */
type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  workspaceId?: string;
  flowId?: string;
  className?: string;
};

export function AudioBubbleSettings({
  block,
  onBlockChange,
  workspaceId,
  flowId,
  className,
}: Props) {
  const options = block.options ?? {};
  const url = String(options.url ?? '');

  const [tab, setTab] = useState<Tab>(
    !url && workspaceId ? 'upload' : url.startsWith('/uploads/') ? 'upload' : 'url',
  );

  const update = useCallback(
    (patch: Record<string, unknown>) => {
      onBlockChange({ ...block, options: { ...options, ...patch } });
    },
    [block, options, onBlockChange],
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)]">
          <Mic className="h-4 w-4 text-[var(--st-accent)]" strokeWidth={1.8} aria-hidden="true" />
        </div>
        <span className="text-[13px] font-semibold text-[var(--st-text)]">
          Audio Bubble
        </span>
      </div>

      {/* Preview */}
      {tab === 'url' && <AudioPreview url={url} />}

      {/* Tabs */}
      {workspaceId && (
        <SegmentedControl<Tab>
          items={TAB_ITEMS}
          value={tab}
          onChange={setTab}
          size="sm"
          fullWidth
          aria-label="Audio source"
        />
      )}

      {tab === 'upload' && workspaceId ? (
        <FileUploadInput
          label="Audio file"
          value={url}
          onChange={(u) => update({ url: u })}
          accept="audio/*"
          flowId={flowId}
          workspaceId={workspaceId}
        />
      ) : (
        <Field
          label="Audio URL"
          help={
            <>
              Supports{' '}
              <code className="rounded bg-[var(--st-bg-secondary)] px-1 font-mono">.mp3</code>,{' '}
              <code className="rounded bg-[var(--st-bg-secondary)] px-1 font-mono">.wav</code>,{' '}
              <code className="rounded bg-[var(--st-bg-secondary)] px-1 font-mono">.ogg</code>, or{' '}
              <code className="rounded bg-[var(--st-bg-secondary)] px-1 font-mono text-[var(--st-accent)]">
                {'{{variable}}'}
              </code>
            </>
          }
        >
          <Input
            type="url"
            value={url}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="https://example.com/audio.mp3 or {{audioUrl}}"
            iconLeft={LinkIcon}
            inputSize="sm"
          />
        </Field>
      )}
    </div>
  );
}
