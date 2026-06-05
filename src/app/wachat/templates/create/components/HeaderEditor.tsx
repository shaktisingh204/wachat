import * as React from 'react';
import { Input } from '@/components/sabcrm/20ui';
import { SabFileUrlInput } from '@/components/sabfiles';
import { HEADER_FORMATS } from '../constants';
import { Field } from './Field';
import { VariableExamples } from './VariableExamples';

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

interface HeaderEditorProps {
  headerFormat: string;
  setHeaderFormat: (v: string) => void;
  headerText: string;
  setHeaderText: (v: string) => void;
  headerMediaUrl: string;
  setHeaderMediaUrl: (v: string) => void;
}

export function HeaderEditor({
  headerFormat,
  setHeaderFormat,
  headerText,
  setHeaderText,
  headerMediaUrl,
  setHeaderMediaUrl,
}: HeaderEditorProps) {
  return (
    <Field label="Header">
      <div className="flex flex-wrap gap-1.5">
        {HEADER_FORMATS.map((h) => {
          const Icon = h.icon;
          const isActive = headerFormat === h.id;
          return (
            <button
              key={h.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setHeaderFormat(h.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-colors"
              style={{
                borderRadius: 'var(--st-radius-sm)',
                border: '1px solid',
                borderColor: isActive ? 'var(--st-border-strong)' : 'var(--st-border)',
                background: isActive ? 'var(--st-hover)' : 'transparent',
                color: isActive ? 'var(--st-text)' : 'var(--st-text-tertiary)',
              }}
            >
              <Icon className="h-3 w-3" /> {h.name}
            </button>
          );
        })}
      </div>

      {headerFormat === 'TEXT' && (
        <div className="mt-2 space-y-2">
          <Input
            name="headerText"
            value={headerText}
            onChange={(e) => setHeaderText(e.target.value)}
            placeholder="Header text (e.g., Welcome {{1}})"
          />
          <VariableExamples text={headerText} prefix="header" />
        </div>
      )}

      {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && (
        <div className="mt-2 space-y-2">
          <SabFileUrlInput
            accept={
              headerFormat === 'IMAGE'
                ? 'image'
                : headerFormat === 'VIDEO'
                  ? 'video'
                  : 'document'
            }
            value={headerMediaUrl}
            onChange={(url) => setHeaderMediaUrl(url ?? '')}
            placeholder="Pick a media file"
            pickerTitle="Pick header media"
          />
          <p className="text-[10px]" style={{ color: 'var(--st-text-tertiary)' }}>
            Pick from your file library or upload a new file. Meta requires a sample for approval. The backend will direct upload this media to Meta using Resumable Upload sessions.
          </p>
        </div>
      )}

      {headerFormat === 'LOCATION' && (
        <p className="mt-2 text-[11px]" style={{ color: 'var(--st-text-tertiary)' }}>
          Location header will prompt the user to share or view a location.
        </p>
      )}
    </Field>
  );
}
