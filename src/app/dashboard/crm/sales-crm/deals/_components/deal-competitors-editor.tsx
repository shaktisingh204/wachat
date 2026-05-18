'use client';

import { ZoruButton, ZoruInput } from '@/components/zoruui';
/**
 * <DealCompetitorsEditor> — free-text competitor chips. Extracted from
 * <DealForm> to keep the parent under the 600-line cap.
 */

import * as React from 'react';

interface DealCompetitorsEditorProps {
  competitors: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}

export function DealCompetitorsEditor({
  competitors,
  onAdd,
  onRemove,
}: DealCompetitorsEditorProps) {
  const [draft, setDraft] = React.useState('');

  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft('');
  };

  return (
    <>
      <div>
        <h2 className="text-[15px] font-semibold text-zoru-ink">Competitors</h2>
        <p className="text-[12.5px] text-zoru-ink-muted">
          Free-text chips for now — wire to a vendor picker in a follow-up.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {competitors.map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1 rounded-full border border-zoru-line bg-zoru-surface-2 px-2 py-0.5 text-[12px]"
          >
            {c}
            <button
              type="button"
              onClick={() => onRemove(c)}
              className="text-zoru-ink-muted hover:text-zoru-ink"
              aria-label={`Remove ${c}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <ZoruInput
          placeholder="Add competitor name…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          className="max-w-xs"
        />
        <ZoruButton type="button" variant="outline" size="sm" onClick={commit}>
          Add
        </ZoruButton>
      </div>
    </>
  );
}
