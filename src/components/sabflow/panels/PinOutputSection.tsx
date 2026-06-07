'use client';

import { useState, useEffect, useMemo } from 'react';
import { Pin, PinOff } from 'lucide-react';
import { Button, Field, Textarea } from '@/components/sabcrm/20ui';
import type { Block } from '@/lib/sabflow/types';

type Props = {
  block: Block;
  onUpdate: (changes: Partial<Block>) => void;
};

/**
 * Phase 10 UI surface. Lets the user pin a block's output so downstream
 * tests can run without re-firing the trigger or hitting third-party APIs.
 *
 * When pinned, the runtime (`runWithRetry`) short-circuits the block's
 * `run()` and uses the stored payload as the result. When unpinned, the
 * block runs live.
 *
 * The pinned shape is `{ outputs: Record<string, unknown> }`, matching
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
    <section className="mt-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
      <header className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--st-text)]">
            {pinned ? (
              <Pin className="h-3.5 w-3.5 text-[var(--st-warn)]" aria-hidden="true" />
            ) : (
              <PinOff className="h-3.5 w-3.5 text-[var(--st-text-tertiary)]" aria-hidden="true" />
            )}
            Pin output
          </h3>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--st-text-secondary)]">
            {pinned
              ? 'Downstream tests use this stored payload, so this block will not run.'
              : 'Block runs live each execution. Pin to lock its output for downstream testing.'}
          </p>
        </div>
        <Button
          variant={pinned ? 'primary' : 'secondary'}
          size="sm"
          onClick={togglePin}
          aria-pressed={pinned}
          iconLeft={pinned ? PinOff : Pin}
          className="shrink-0"
        >
          {pinned ? 'Unpin' : 'Pin'}
        </Button>
      </header>

      {pinned && (
        <div className="mt-3">
          <Field
            label="Pinned outputs (JSON)"
            error={jsonError ?? undefined}
            help={
              jsonError ? undefined : (
                <>
                  Changes save when you click outside the box. Downstream blocks
                  read these as{' '}
                  <code>$node[&quot;…&quot;].json.&lt;field&gt;</code>.
                </>
              )
            }
          >
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={commit}
              rows={6}
              spellCheck={false}
              className="font-mono text-[11px]"
              placeholder='{ "field": "value" }'
            />
          </Field>
        </div>
      )}
    </section>
  );
}
