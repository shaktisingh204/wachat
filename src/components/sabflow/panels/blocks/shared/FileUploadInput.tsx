'use client';

/**
 * FileUploadInput
 *
 * Reusable file picker used by block settings (image, video, audio
 * bubbles) to let editors choose an asset and drop the returned URL into
 * the block's options.
 *
 * Per SabNode policy every file lives in SabFiles, so this is a thin
 * wrapper around the project-wide SabFilePicker (library + upload, no
 * free-text URL paste). The public Props API (value / onChange / accept /
 * flowId / workspaceId / label / className) is preserved so existing call
 * sites keep working unchanged.
 */

import { useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  Label,
  cn,
} from '@/components/sabcrm/20ui';
import {
  SabFilePicker,
  type SabFileAccept,
  type SabFilePick,
} from '@/components/sabfiles';

type Props = {
  /** Current persisted URL (picked previously). Empty string if none. */
  value?: string;
  /** Called with the new URL once a file is picked. */
  onChange: (url: string) => void;
  /** MIME-style hint (e.g. "image/*"); mapped to a SabFiles category. */
  accept?: string;
  /** Optional flow association for metadata. Kept for API compatibility. */
  flowId?: string;
  /** Owning workspace id (authoring user). Kept for API compatibility. */
  workspaceId?: string;
  /** Visual-only label above the picker. */
  label?: string;
  className?: string;
};

/** Map an `accept` MIME hint to the SabFiles picker category. */
function acceptCategory(accept?: string): SabFileAccept {
  if (!accept) return 'all';
  if (accept.startsWith('image/')) return 'image';
  if (accept.startsWith('video/')) return 'video';
  if (accept.startsWith('audio/')) return 'audio';
  return 'all';
}

/** Derive a friendly file name from a SabFiles URL when none is cached. */
function nameFromUrl(url: string): string {
  if (!url) return '';
  const last = url.split('?')[0].split('/').filter(Boolean).pop() ?? url;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function isImageUrl(url: string, mime?: string): boolean {
  if (mime?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(url);
}

export function FileUploadInput({
  value,
  onChange,
  accept,
  label,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<SabFilePick | null>(null);

  const hasValue = Boolean(value);
  const displayName = pick?.name ?? (value ? nameFromUrl(value) : '');
  const showImagePreview =
    hasValue && isImageUrl(value ?? '', pick?.mime);

  const handlePick = (picked: SabFilePick) => {
    setPick(picked);
    onChange(picked.url);
  };

  const handleRemove = () => {
    setPick(null);
    onChange('');
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label className="text-[11.5px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
          {label}
        </Label>
      )}

      {hasValue ? (
        <Card padding="none" className="overflow-hidden">
          <CardBody className="space-y-2 p-2.5">
            {showImagePreview ? (
              <div className="h-[120px] w-full overflow-hidden rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={value}
                  alt={displayName || 'Picked file'}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] px-3 py-2.5 text-[12.5px] text-[var(--st-text)]">
                <FileText
                  className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)]"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <span className="truncate">{displayName}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                iconLeft={Upload}
                onClick={() => setOpen(true)}
              >
                Replace
              </Button>
              <Button
                size="sm"
                variant="ghost"
                iconLeft={X}
                onClick={handleRemove}
              >
                Remove
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Button
          block
          variant="outline"
          iconLeft={Upload}
          onClick={() => setOpen(true)}
          className="justify-center border-dashed py-5"
        >
          Choose a file from SabFiles
        </Button>
      )}

      <SabFilePicker
        open={open}
        onOpenChange={setOpen}
        accept={acceptCategory(accept)}
        onPick={handlePick}
      />
    </div>
  );
}
