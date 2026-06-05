import * as React from 'react';
import { Button, Input } from '@/components/sabcrm/20ui';
import { SabFileUrlInput } from '@/components/sabfiles';
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
            <Button
              key={h.id}
              type="button"
              variant={isActive ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={isActive}
              iconLeft={<Icon className="h-3 w-3" />}
              onClick={() => setHeaderFormat(h.id)}
            >
              {h.name}
            </Button>
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
          <p className="text-[10px] text-[var(--st-text-tertiary)]">
            Pick from your file library or upload a new file. Meta requires a sample for approval. The backend will direct upload this media to Meta using Resumable Upload sessions.
          </p>
        </div>
      )}

      {headerFormat === 'LOCATION' && (
        <p className="mt-2 text-[11px] text-[var(--st-text-tertiary)]">
          Location header will prompt the user to share or view a location.
        </p>
      )}
    </Field>
  );
}
