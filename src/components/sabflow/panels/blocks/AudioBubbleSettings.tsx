'use client';
import { useCallback } from 'react';
import type { Block } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { LuMic, LuLink, LuMusic } from 'react-icons/lu';

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

/* ── Audio preview ──────────────────────────────────────────── */
function AudioPreview({ url }: { url: string }) {
  if (!url || /^{{.*}}$/.test(url)) return null;

  return (
    <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-3)] p-3">
      <div className="flex items-center gap-2 mb-2 text-[var(--gray-9)]">
        <LuMusic className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
        <span className="text-[11px] truncate">{url.split('/').pop() ?? 'Audio file'}</span>
      </div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        key={url}
        src={url}
        controls
        className="w-full h-8"
        style={{ accentColor: '#f76808' }}
      />
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  className?: string;
};

export function AudioBubbleSettings({ block, onBlockChange, className }: Props) {
  const options = block.options ?? {};
  const url = String(options.url ?? '');

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
          <LuMic className="h-4 w-4 text-[#f76808]" strokeWidth={1.8} />
        </div>
        <span className="text-[13px] font-semibold text-[var(--gray-12)]">
          Audio Bubble
        </span>
      </div>

      {/* Preview */}
      <AudioPreview url={url} />

      {/* URL input */}
      <Field label="Audio URL">
        <div className="relative flex items-center">
          <LuLink
            className="absolute left-3 h-3.5 w-3.5 text-[var(--gray-7)] pointer-events-none"
            strokeWidth={1.8}
          />
          <input
            type="url"
            value={url}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="https://example.com/audio.mp3 or {{audioUrl}}"
            className={cn(inputClass, 'pl-8')}
          />
        </div>
        <p className="text-[11px] text-[var(--gray-8)]">
          Supports{' '}
          <code className="font-mono bg-[var(--gray-3)] px-1 rounded">.mp3</code>,{' '}
          <code className="font-mono bg-[var(--gray-3)] px-1 rounded">.wav</code>,{' '}
          <code className="font-mono bg-[var(--gray-3)] px-1 rounded">.ogg</code>, or{' '}
          <code className="font-mono bg-[var(--gray-3)] px-1 rounded text-[#f76808]">
            {'{{variable}}'}
          </code>
        </p>
      </Field>
    </div>
  );
}
