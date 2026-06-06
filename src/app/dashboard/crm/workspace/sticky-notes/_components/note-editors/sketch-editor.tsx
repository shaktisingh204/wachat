'use client';

/**
 * Sketch note kind — v1 is a SabFiles image picker placeholder. A real
 * canvas drawing surface is a follow-up (planned: integrate the existing
 * canvas primitive used in CRM signature pads).
 *
 * Stores `{ kind: 'sketch', fileId, name, url }` in blocksJson.
 */

import * as React from 'react';
import { Brush, Trash2 } from 'lucide-react';
import Image from 'next/image';

import { Button } from '@/components/sabcrm/20ui/compat';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

export interface SketchValue {
  fileId?: string;
  name?: string;
  url?: string;
}

export interface SketchEditorProps {
  value: SketchValue | null;
  onChange: (next: SketchValue | null) => void;
  disabled?: boolean;
}

export function SketchEditor({ value, onChange, disabled }: SketchEditorProps) {
  const handlePick = React.useCallback(
    (pick: SabFilePick) => {
      if (!pick) return;
      onChange({ fileId: pick.id, name: pick.name, url: pick.url });
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-md border border-dashed border-[var(--zoru-border)] bg-[var(--zoru-muted)] p-4 text-sm text-[var(--zoru-muted-foreground)]">
        <Brush className="h-4 w-4" />
        <span>
          Canvas drawing is on its way. For now, attach an existing sketch
          from SabFiles.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <SabFilePickerButton accept="image" onPick={handlePick}>
          {value?.fileId ? 'Change sketch' : 'Pick image from SabFiles'}
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
      {value?.url && (
        <div className="relative aspect-video w-full overflow-hidden rounded-md border border-[var(--zoru-border)]">
          <Image
            src={value.url}
            alt={value.name ?? 'Sketch'}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain"
            unoptimized
          />
        </div>
      )}
    </div>
  );
}
