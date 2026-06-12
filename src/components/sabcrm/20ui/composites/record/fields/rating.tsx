'use client';

/**
 * RecordSurface fields — RATING.
 *
 * Display: five star glyphs, filled up to the value (Twenty parity).
 * Edit: the same stars as buttons — hover previews, click commits, arrow
 * keys adjust the draft, Enter commits, Escape cancels.
 */

import * as React from 'react';

import {
  EmptyValue,
  isEmpty,
  type FieldDisplayProps,
  type FieldEditorProps,
} from './shared';

const RATING_MAX = 5;

function clamp(n: number): number {
  return Math.max(0, Math.min(RATING_MAX, Math.round(n)));
}

export function RatingDisplay({ value }: FieldDisplayProps): React.JSX.Element {
  if (isEmpty(value)) return <EmptyValue />;
  const n = Number(value);
  if (Number.isNaN(n)) return <span className="rc-text">{String(value)}</span>;
  const filled = clamp(n);
  return (
    <span className="rc-stars" aria-label={`${filled} out of ${RATING_MAX}`}>
      {Array.from({ length: RATING_MAX }).map((_, i) => (
        <span
          key={i}
          className={`rc-star${i < filled ? ' is-on' : ''}`}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </span>
  );
}

export function RatingEditor({
  field,
  value,
  onCommit,
  onCancel,
}: FieldEditorProps): React.JSX.Element {
  const initial = clamp(Number(value) || 0);
  const [draft, setDraft] = React.useState(initial);
  const [hover, setHover] = React.useState<number | null>(null);
  const shown = hover ?? draft;
  const rootRef = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    rootRef.current?.focus();
  }, []);

  return (
    <span
      ref={rootRef}
      className="rc-stars rc-stars--edit"
      role="slider"
      aria-label={field.label}
      aria-valuemin={0}
      aria-valuemax={RATING_MAX}
      aria-valuenow={draft}
      tabIndex={0}
      onMouseLeave={() => setHover(null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          setDraft((d) => clamp(d + 1));
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          setDraft((d) => clamp(d - 1));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          onCommit(draft);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
      onBlur={() => onCommit(draft)}
    >
      {Array.from({ length: RATING_MAX }).map((_, i) => (
        <button
          key={i}
          type="button"
          tabIndex={-1}
          className={`rc-star rc-star--btn${i < shown ? ' is-on' : ''}`}
          aria-label={`${i + 1} star${i ? 's' : ''}`}
          onMouseEnter={() => setHover(i + 1)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            // Clicking the current value clears the rating (toggle off).
            const next = draft === i + 1 ? 0 : i + 1;
            setDraft(next);
            onCommit(next);
          }}
        >
          ★
        </button>
      ))}
    </span>
  );
}
