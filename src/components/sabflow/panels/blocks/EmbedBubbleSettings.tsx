'use client';

import { useCallback, useState } from 'react';
import { Code, Link, Minus, Plus } from 'lucide-react';

import type { Block } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { Button, Field, Input, Textarea } from '@/components/sabcrm/20ui';

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
      className="relative w-full overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
      // Runtime-computed: preview frame height follows the user-chosen value (capped).
      style={{ height: `${Math.min(height, 320)}px` }}
    >
      <iframe
        key={url}
        src={url}
        title="Embed preview"
        className="pointer-events-none absolute inset-0 h-full w-full rounded-[var(--st-radius)]"
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
      <Button
        variant="outline"
        size="sm"
        iconLeft={Minus}
        onClick={decrement}
        disabled={value <= MIN}
        aria-label="Decrease height"
      />

      <Input
        type="number"
        min={MIN}
        max={MAX}
        step={STEP}
        value={value}
        inputSize="sm"
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n)) onChange(Math.min(MAX, Math.max(MIN, n)));
        }}
        className="w-24 text-center"
        aria-label="Display height in pixels"
      />

      <Button
        variant="outline"
        size="sm"
        iconLeft={Plus}
        onClick={increment}
        disabled={value >= MAX}
        aria-label="Increase height"
      />

      <span className="text-[12px] text-[var(--st-text-tertiary)]">px</span>
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
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)]">
          <Code className="h-4 w-4 text-[var(--st-accent)]" strokeWidth={1.8} aria-hidden="true" />
        </div>
        <span className="text-[13px] font-semibold text-[var(--st-text)]">Embed Bubble</span>
      </div>

      {/* Preview */}
      <EmbedPreview url={rawUrl} height={height} />

      {/* URL / embed code input */}
      <Field
        label={
          <span className="inline-flex items-center gap-1.5">
            <Link className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
            URL or embed code
          </span>
        }
        help="Paste a URL or an <iframe> tag. The src will be extracted automatically."
      >
        <Textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          onBlur={(e) => handleUrlCommit(e.target.value)}
          placeholder={'https://example.com/page\nor\n<iframe src="https://..." />'}
          rows={3}
          className="min-h-[72px] resize-y font-mono text-[12px]"
        />
      </Field>

      {/* Height */}
      <Field label="Display height">
        <HeightStepper value={height} onChange={(h) => update({ height: h })} />
      </Field>
    </div>
  );
}
