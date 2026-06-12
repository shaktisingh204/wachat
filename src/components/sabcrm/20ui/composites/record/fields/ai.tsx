'use client';

/**
 * RecordSurface fields — AI (LLM-computed, `FieldType: 'AI'`).
 *
 * Display: a leading Sparkles glyph + the computed scalar as text, with a
 * state affix read from the record's `data.__ai.<key>` meta envelope
 * (see `src/lib/sabcrm/ai-fields.server.ts`):
 *   - `pending` → a small spinner ("Computing");
 *   - `failed`  → a warning glyph whose tooltip carries the error;
 *   - no value & no meta → the muted em-dash.
 *
 * Edit: AI values are SYSTEM-computed — the editor IS the display (exact
 * precedent: ACTOR). It calls neither `onCommit` nor renders an input; the
 * *recompute* affordance is a host concern (field components make no server
 * calls — see the contract in `record-cell.tsx`).
 *
 * Imports are relative (never the 20ui root barrel) per the folder rule.
 */

import * as React from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';

import { Spinner } from '../../../loading';
import {
  EmptyValue,
  isEmpty,
  type FieldDisplayProps,
  type FieldEditorProps,
} from './shared';

/** The `data.__ai.<key>` meta envelope (defensively typed). */
interface AiCellMeta {
  status?: string;
  error?: string | null;
  computedAt?: string;
  inputsHash?: string;
}

/** Read this field's AI meta off the record's reserved `__ai` namespace. */
function aiMetaFor(
  record: FieldDisplayProps['record'],
  fieldKey: string,
): AiCellMeta | null {
  const bag = record?.data?.__ai;
  if (!bag || typeof bag !== 'object' || Array.isArray(bag)) return null;
  const meta = (bag as Record<string, unknown>)[fieldKey];
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  return meta as AiCellMeta;
}

export function AiDisplay({
  field,
  value,
  record,
}: FieldDisplayProps): React.JSX.Element {
  const meta = aiMetaFor(record, field.key);
  const hasValue = !isEmpty(value);

  // SELECT-typed outputs store the option VALUE; show its label like
  // SelectDisplay does. Everything else stringifies.
  let text = '';
  if (hasValue) {
    const opt = field.options?.find((o) => o.value === value);
    text = opt?.label ?? String(value);
  }

  return (
    <span className="rc-ai">
      <Sparkles size={12} aria-hidden className="rc-ai__icon" />
      {hasValue ? (
        <span className="rc-ai__text">{text}</span>
      ) : meta ? null : (
        <EmptyValue />
      )}
      {meta?.status === 'pending' ? (
        <Spinner size="sm" aria-label="Computing" />
      ) : null}
      {meta?.status === 'failed' ? (
        <span
          className="rc-ai__err"
          title={meta.error ?? 'Computation failed'}
          role="img"
          aria-label={`Failed: ${meta.error ?? 'computation failed'}`}
        >
          <AlertTriangle size={12} aria-hidden />
        </span>
      ) : null}
    </span>
  );
}

/**
 * AI values are system-computed — the "editor" is the display (ACTOR
 * precedent). No input, no `onCommit`.
 */
export function AiEditor(props: FieldEditorProps): React.JSX.Element {
  return <AiDisplay {...props} />;
}
