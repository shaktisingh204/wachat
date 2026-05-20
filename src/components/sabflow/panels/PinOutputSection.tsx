'use client';

import { useState, useEffect, useMemo } from 'react';
import { LuPin, LuPinOff } from 'react-icons/lu';
import type { Block } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';

type Props = {
  block: Block;
  onUpdate: (changes: Partial<Block>) => void;
};

/**
 * Phase 10 UI surface — lets the user pin a block's output so downstream
 * tests can run without re-firing the trigger / hitting third-party APIs.
 *
 * When pinned, the runtime (`runWithRetry`) short-circuits the block's
 * `run()` and uses the stored payload as the result. When unpinned, the
 * block runs live.
 *
 * The pinned shape is `{ outputs: Record<string, unknown> }` — matching
 * the strict `Block.pinData` type. The textarea is a JSON editor so power
 * users can tweak field values without re-running.
 */
export function PinOutputSection({ block, onUpdate }: Props) {
  const pinned = block.pinData !== undefined;
  const initialText = useMemo(() => {
    if (!block.pinData?.outputs) return '{}';
    try {
      return JSON.stringify(block.pinData.outputs, null, 2);
    } catch {
      return '{}';
    }
  }, [block.pinData?.outputs]);

  const [text, setText] = useState(initialText);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Sync local text when the pinned payload changes from outside (e.g. a
  // "capture from last run" button populates it).
  useEffect(() => {
    setText(initialText);
    setJsonError(null);
  }, [initialText]);

  const togglePin = () => {
    if (pinned) {
      onUpdate({ pinData: undefined });
      setJsonError(null);
      return;
    }
    onUpdate({ pinData: { outputs: {} } });
  };

  const commit = () => {
    let parsed: Record<string, unknown>;
    try {
      const raw = JSON.parse(text);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        setJsonError('Pinned output must be a JSON object.');
        return;
      }
      parsed = raw as Record<string, unknown>;
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
      return;
    }
    setJsonError(null);
    onUpdate({ pinData: { outputs: parsed } });
  };

  return (
    <section className="mt-4 rounded-lg border border-[var(--gray-4)] bg-[var(--gray-2)] p-3">
      <header className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--gray-12)]">
            {pinned ? (
              <LuPin className="h-3.5 w-3.5 text-[var(--amber-10)]" />
            ) : (
              <LuPinOff className="h-3.5 w-3.5 text-[var(--gray-9)]" />
            )}
            Pin output
          </h3>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--gray-10)]">
            {pinned
              ? 'Downstream tests use this stored payload — this block will not run.'
              : 'Block runs live each execution. Pin to lock its output for downstream testing.'}
          </p>
        </div>
        <button
          type="button"
          onClick={togglePin}
          className={cn(
            'shrink-0 rounded px-2 py-1 text-[11px] font-medium transition-colors',
            pinned
              ? 'bg-[var(--amber-3)] text-[var(--amber-11)] hover:bg-[var(--amber-4)]'
              : 'bg-[var(--gray-4)] text-[var(--gray-11)] hover:bg-[var(--gray-5)]',
          )}
          aria-pressed={pinned}
        >
          {pinned ? 'Unpin' : 'Pin'}
        </button>
      </header>

      {pinned && (
        <div className="mt-3 flex flex-col gap-1.5">
          <label className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--gray-9)]">
            Pinned outputs (JSON)
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            rows={6}
            spellCheck={false}
            className={cn(
              'w-full resize-y rounded border bg-[var(--gray-1)] px-2 py-1.5 font-mono text-[11px] text-[var(--gray-12)]',
              jsonError
                ? 'border-[var(--red-7)] focus:border-[var(--red-8)]'
                : 'border-[var(--gray-5)] focus:border-[var(--gray-7)]',
              'outline-none',
            )}
            placeholder='{ "field": "value" }'
          />
          {jsonError ? (
            <p className="text-[10.5px] text-[var(--red-10)]">{jsonError}</p>
          ) : (
            <p className="text-[10.5px] text-[var(--gray-9)]">
              Changes save when you click outside the box. Downstream blocks
              read these as <code>$node[&quot;…&quot;].json.&lt;field&gt;</code>.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
