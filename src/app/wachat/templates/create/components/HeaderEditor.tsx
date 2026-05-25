import * as React from 'react';
import { Input, ZoruFileInput, cn } from '@/components/zoruui';
import { HEADER_FORMATS } from '../constants';
import { Field } from './Field';
import { VariableExamples } from './VariableExamples';

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
              onClick={() => setHeaderFormat(h.id)}
              className={cn(
                'flex items-center gap-1 rounded-[var(--zoru-radius)] border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                isActive
                  ? 'border-zoru-ink bg-zoru-surface-2 text-zoru-ink'
                  : 'border-zoru-line text-zoru-ink-muted hover:text-zoru-ink',
              )}
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
          <ZoruFileInput
            accept={
              headerFormat === 'IMAGE'
                ? 'image'
                : headerFormat === 'VIDEO'
                  ? 'video'
                  : 'document'
            }
            value={headerMediaUrl ? { id: headerMediaUrl, name: headerMediaUrl, mimeType: '', size: 0, tag: 'other', url: headerMediaUrl, key: headerMediaUrl, createdAt: '' } : null}
            onChange={(file) => setHeaderMediaUrl(file?.url ?? '')}
            placeholder="Pick a media file"
            pickerTitle="Pick header media"
          />
          <p className="text-[10px] text-zoru-ink-muted">
            Pick from your file library or upload a new file. Meta requires a sample for approval. The backend will direct upload this media to Meta using Resumable Upload sessions.
          </p>
        </div>
      )}

      {headerFormat === 'LOCATION' && (
        <p className="mt-2 text-[11px] text-zoru-ink-muted">
          Location header will prompt the user to share or view a location.
        </p>
      )}
    </Field>
  );
}
