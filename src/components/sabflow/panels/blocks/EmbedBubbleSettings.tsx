'use client';
import { useCallback, useState } from 'react';
import type { Block } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { LuCode, LuLink, LuMinus, LuPlus } from 'react-icons/lu';

/* ── Shared primitives ──────────────────────────────────────── */
const inputClass =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[var(--gray-8)]">{hint}</p>}
    </div>
  );
}

/* ── Sanitize: extract src from <iframe> tags ───────────────── */
function extractIframeSrc(raw: string): string {
  const match = raw.match(/src=["']([^"']+)["']/);
  return match ? match[1] : raw;
}

function sanitizeEmbedInput(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('<iframe')) return extractIframeSrc(trimmed);
  return trimmed;
}

/* ── Embed preview ──────────────────────────────────────────── */
function EmbedPreview({ url, height }: { url: string; height: number }) {
  if (!url || /^{{.*}}$/.test(url)) return null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-[var(--gray-5)] bg-[var(--gray-3)]"
      style={{ height: `${Math.min(height, 320)}px` }}
    >
      <iframe
        key={url}
        src={url}
        title="Embed preview"
        className="absolute inset-0 h-full w-full rounded-lg"
        style={{ pointerEvents: 'none' }}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}

/* ── Height stepper ─────────────────────────────────────────── */
const STEP = 50;
const MIN = 100;
const MAX = 2000;

function HeightStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const decrement = () => onChange(Math.max(MIN, value - STEP));
  const increment = () => onChange(Math.min(MAX, value + STEP));

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={decrement}
        disabled={value <= MIN}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-9)] hover:border-[#f76808] hover:text-[#f76808] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Decrease height"
      >
        <LuMinus className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

      <input
        type="number"
        min={MIN}
        max={MAX}
        step={STEP}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n)) onChange(Math.min(MAX, Math.max(MIN, n)));
        }}
        className={cn(
          inputClass,
          'w-24 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        )}
      />

      <button
        type="button"
        onClick={increment}
        disabled={value >= MAX}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-9)] hover:border-[#f76808] hover:text-[#f76808] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Increase height"
      >
        <LuPlus className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

      <span className="text-[12px] text-[var(--gray-8)]">px</span>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
const DEFAULT_HEIGHT = 400;

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  className?: string;
};

export function EmbedBubbleSettings({ block, onBlockChange, className }: Props) {
  const options = block.options ?? {};
  const rawUrl = String(options.url ?? '');
  const height = typeof options.height === 'number' ? options.height : DEFAULT_HEIGHT;

  // Tracks the raw textarea value (may contain <iframe> tags before sanitizing)
  const [rawInput, setRawInput] = useState(rawUrl);

  const update = useCallback(
    (patch: Record<string, unknown>) => {
      onBlockChange({ ...block, options: { ...options, ...patch } });
    },
    [block, options, onBlockChange],
  );

  const handleUrlCommit = (raw: string) => {
    const sanitized = sanitizeEmbedInput(raw);
    setRawInput(sanitized);
    update({ url: sanitized });
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f76808]/10">
          <LuCode className="h-4 w-4 text-[#f76808]" strokeWidth={1.8} />
        </div>
        <span className="text-[13px] font-semibold text-[var(--gray-12)]">
          Embed Bubble
        </span>
      </div>

      {/* Preview */}
      <EmbedPreview url={rawUrl} height={height} />

      {/* URL / embed code input */}
      <Field
        label="URL or embed code"
        hint="Paste a URL or an <iframe> tag — the src will be extracted automatically."
      >
        <div className="relative flex items-start">
          <LuLink
            className="absolute left-3 top-[11px] h-3.5 w-3.5 text-[var(--gray-7)] pointer-events-none"
            strokeWidth={1.8}
          />
          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            onBlur={(e) => handleUrlCommit(e.target.value)}
            placeholder={'https://example.com/page\nor\n<iframe src="https://…" />'}
            rows={3}
            className={cn(inputClass, 'pl-8 resize-y min-h-[72px] font-mono text-[12px]')}
          />
        </div>
      </Field>

      {/* Height */}
      <Field label="Display height">
        <HeightStepper value={height} onChange={(h) => update({ height: h })} />
      </Field>
    </div>
  );
}
