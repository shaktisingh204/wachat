'use client';

import { useCallback, useState } from 'react';
import { Image as ImageIcon, Link as LinkIcon, CircleAlert, Upload } from 'lucide-react';

import type { Block } from '@/lib/sabflow/types';
import { cn, Field, Input, SegmentedControl } from '@/components/sabcrm/20ui';
import { FileUploadInput } from './shared/FileUploadInput';

/* ── Preview thumbnail ──────────────────────────────────────── */
function ImagePreview({ url }: { url: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('loading');

  if (!url) return null;

  return (
    <div className="relative h-[120px] w-full overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
      {status === 'error' ? (
        <div className="flex h-full flex-col items-center justify-center gap-1.5 text-[var(--st-text-tertiary)]">
          <CircleAlert className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
          <span className="text-[11px]">Could not load image</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Preview"
          onLoad={() => setStatus('ok')}
          onError={() => setStatus('error')}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-200',
            status === 'ok' ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
type Tab = 'upload' | 'url';

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  /** Owning workspace id, required for uploads. */
  workspaceId?: string;
  /** Current flow id, attached to upload metadata. */
  flowId?: string;
  className?: string;
};

export function ImageBubbleSettings({
  block,
  onBlockChange,
  workspaceId,
  flowId,
  className,
}: Props) {
  const options = block.options ?? {};
  const url = String(options.url ?? '');
  const alt = String(options.alt ?? '');

  // Default to "upload" tab when no URL yet AND we have a workspace to upload to.
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
          <ImageIcon className="h-4 w-4 text-[var(--st-accent)]" strokeWidth={1.8} aria-hidden="true" />
        </div>
        <span className="text-[13px] font-semibold text-[var(--st-text)]">
          Image Bubble
        </span>
      </div>

      {/* Preview, only shown for URL tab (upload tab has its own preview) */}
      {tab === 'url' && <ImagePreview url={url} />}

      {/* Tabs, only if we can actually upload (workspaceId known) */}
      {workspaceId && (
        <SegmentedControl<Tab>
          aria-label="Image source"
          fullWidth
          size="sm"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'upload', label: 'Upload', icon: Upload },
            { value: 'url', label: 'URL', icon: LinkIcon },
          ]}
        />
      )}

      {/* Upload tab */}
      {tab === 'upload' && workspaceId && (
        <FileUploadInput
          label="Image file"
          value={url}
          onChange={(u) => update({ url: u })}
          accept="image/*"
          flowId={flowId}
          workspaceId={workspaceId}
        />
      )}

      {/* URL tab */}
      {tab === 'url' && (
        <Field
          label="Image URL"
          help="Supports direct URLs or a {{variable}} expression."
        >
          <Input
            type="url"
            inputSize="sm"
            iconLeft={LinkIcon}
            value={url}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="https://example.com/image.png or {{imageUrl}}"
          />
        </Field>
      )}

      {/* Alt text */}
      <Field label="Alt text">
        <Input
          type="text"
          inputSize="sm"
          value={alt}
          onChange={(e) => update({ alt: e.target.value })}
          placeholder="Describe the image for accessibility."
        />
      </Field>
    </div>
  );
}
