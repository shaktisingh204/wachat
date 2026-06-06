'use client';

/**
 * File note kind — generic SabFiles attachment.
 *
 * Stores `{ kind: 'file', fileId, name, mime, size, url }` in blocksJson.
 */

import * as React from 'react';
import { File as FileIcon, Trash2 } from 'lucide-react';

import { Button } from '@/components/sabcrm/20ui/compat';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

export interface FileValue {
  fileId?: string;
  name?: string;
  mime?: string;
  size?: number;
  url?: string;
}

export interface FileEditorProps {
  value: FileValue | null;
  onChange: (next: FileValue | null) => void;
  disabled?: boolean;
}

function fmtSize(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  const u = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}

export function FileEditor({ value, onChange, disabled }: FileEditorProps) {
  const handlePick = React.useCallback(
    (pick: SabFilePick) => {
      if (!pick) return;
      onChange({
        fileId: pick.id,
        name: pick.name,
        mime: pick.mime,
        size: pick.size,
        url: pick.url,
      });
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <SabFilePickerButton accept="all" onPick={handlePick}>
          {value?.fileId ? 'Change file' : 'Pick from SabFiles'}
        </SabFilePickerButton>
        {value?.fileId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        )}
      </div>
      {value?.fileId && (
        <a
          href={value.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-md border border-[var(--zoru-border)] p-3 hover:bg-[var(--zoru-muted)]"
        >
          <FileIcon className="h-6 w-6 text-[var(--zoru-muted-foreground)]" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">
              {value.name ?? 'Attachment'}
            </span>
            <span className="text-xs text-[var(--zoru-muted-foreground)]">
              {value.mime ?? '—'} {value.size ? `· ${fmtSize(value.size)}` : ''}
            </span>
          </div>
        </a>
      )}
    </div>
  );
}
