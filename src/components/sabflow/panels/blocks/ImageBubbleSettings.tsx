'use client';
import { useCallback, useState } from 'react';
import type { Block } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { LuImage, LuLink, LuCircleAlert, LuUpload } from 'react-icons/lu';
import { FileUploadInput } from './shared/FileUploadInput';

/* ── Shared primitives ──────────────────────────────────────── */
const inputClass =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

/* ── Preview thumbnail ──────────────────────────────────────── */
function ImagePreview({ url }: { url: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('loading');

  if (!url) return null;

  return (
    <div className="relative h-[120px] w-full overflow-hidden rounded-lg border border-[var(--gray-5)] bg-[var(--gray-3)]">
      {status === 'error' ? (
        <div className="flex h-full flex-col items-center justify-center gap-1.5 text-[var(--gray-8)]">
          <LuCircleAlert className="h-5 w-5" strokeWidth={1.5} />
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

/* ── Tab switcher ──────────────────────────────────────────── */
type Tab = 'upload' | 'url';

function TabSwitcher({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (next: Tab) => void;
}) {
  const btn = (tab: Tab, label: string, Icon: typeof LuUpload) => (
    <button
      key={tab}
      type="button"
      onClick={() => onChange(tab)}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors',
        active === tab
          ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm'
          : 'text-[var(--gray-9)] hover:text-[var(--gray-11)]',
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-1 rounded-lg bg-[var(--gray-3)] p-1">
      {btn('upload', 'Upload', LuUpload)}
      {btn('url', 'URL', LuLink)}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  /** Owning workspace id — required for uploads. */
  workspaceId?: string;
  /** Current flow id — attached to upload metadata. */
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
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f76808]/10">
          <LuImage className="h-4 w-4 text-[#f76808]" strokeWidth={1.8} />
        </div>
        <span className="text-[13px] font-semibold text-[var(--gray-12)]">
          Image Bubble
        </span>
      </div>

      {/* Preview — only shown for URL tab (upload tab has its own preview) */}
      {tab === 'url' && <ImagePreview url={url} />}

      {/* Tabs — only if we can actually upload (workspaceId known) */}
      {workspaceId && <TabSwitcher active={tab} onChange={setTab} />}

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
        <Field label="Image URL">
          <div className="relative flex items-center">
            <LuLink
              className="absolute left-3 h-3.5 w-3.5 text-[var(--gray-7)] pointer-events-none"
              strokeWidth={1.8}
            />
            <input
              type="url"
              value={url}
              onChange={(e) => update({ url: e.target.value })}
              placeholder="https://example.com/image.png or {{imageUrl}}"
              className={cn(inputClass, 'pl-8')}
            />
          </div>
          <p className="text-[11px] text-[var(--gray-8)]">
            Supports direct URLs or{' '}
            <code className="font-mono bg-[var(--gray-3)] px-1 rounded text-[#f76808]">
              {'{{variable}}'}
            </code>
          </p>
        </Field>
      )}

      {/* Alt text */}
      <Field label="Alt text">
        <input
          type="text"
          value={alt}
          onChange={(e) => update({ alt: e.target.value })}
          placeholder="Describe the image for accessibility…"
          className={inputClass}
        />
      </Field>
    </div>
  );
}
