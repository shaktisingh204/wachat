'use client';

/**
 * RecordSurface fields — FILE.
 *
 * Display: image-like files (avatars, logos, *.png …) render as a small
 * Avatar (Twenty's media-cell look); everything else renders as a file-name
 * link chip.
 *
 * Edit: SabFiles ONLY — the `SabFileUrlInput` picker (library + upload).
 * Per project policy there is never a free-text URL paste for files; picking
 * commits, clearing commits `null`, Escape cancels. The stored shape
 * round-trips: a `{ url, name }` descriptor stays a descriptor, a bare url
 * string stays a string.
 */

import * as React from 'react';
import { Paperclip } from 'lucide-react';

import { SabFileUrlInput } from '@/components/sabfiles';
import { Avatar } from '../../../avatar';
import {
  EmptyValue,
  asRecord,
  linkLabel,
  looksLikeImage,
  parseFileValue,
  toHref,
  type FieldDisplayProps,
  type FieldEditorProps,
} from './shared';

/** Person-ish file fields (avatars, photos) draw round; the rest square. */
function isRoundKey(key: string): boolean {
  const k = key.toLowerCase();
  return k.includes('avatar') || k.includes('photo') || k.includes('picture');
}

/** Image-ish fields restrict the picker to the image library tab. */
function fileAccept(field: FieldDisplayProps['field']): 'image' | 'all' {
  const k = field.key.toLowerCase();
  return isRoundKey(k) || k.includes('logo') || k.includes('image')
    ? 'image'
    : 'all';
}

/* =========================================================================
   Display
   ========================================================================= */

export function FileDisplay({ field, value }: FieldDisplayProps): React.JSX.Element {
  const { url, name: rawName } = parseFileValue(value);
  if (!url) return <EmptyValue />;

  // Image-like files render as a small avatar with an initials fallback,
  // mirroring Twenty's media cells.
  if (looksLikeImage(url, field)) {
    const display = rawName || field.label || 'Image';
    return (
      <Avatar
        name={display}
        src={url}
        size="sm"
        shape={isRoundKey(field.key) ? 'round' : 'square'}
        className="rc-file-avatar"
      />
    );
  }

  const name = rawName || linkLabel(url);
  return (
    <a
      href={toHref(url)}
      target="_blank"
      rel="noopener noreferrer"
      className="rc-file"
      title={name}
      onClick={(e) => e.stopPropagation()}
    >
      <Paperclip size={12} aria-hidden="true" className="rc-file__icon" />
      <span className="rc-file__name">{name}</span>
    </a>
  );
}

/* =========================================================================
   Editor
   ========================================================================= */

/**
 * FILE editor — `SabFileUrlInput` (SabFiles library + upload; no URL paste).
 * The picker dialog portals outside the cell, so there is no blur-commit:
 * picking a file commits, clearing commits `null`, Escape cancels.
 */
export function FileEditor({
  field,
  value,
  onCommit,
  onCancel,
}: FieldEditorProps): React.JSX.Element {
  const { url } = parseFileValue(value);
  return (
    <span
      className="rc-editor-row rc-editor-row--file"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <SabFileUrlInput
        value={url}
        accept={fileAccept(field)}
        pickerTitle={`Pick ${field.label}`}
        onChange={(nextUrl, pick) => {
          if (!nextUrl) {
            onCommit(null);
            return;
          }
          // Round-trip the stored shape: descriptors stay descriptors
          // (refreshing url + name), bare strings stay bare strings.
          const rec = asRecord(value);
          if (rec) {
            onCommit({
              ...rec,
              url: nextUrl,
              name: pick?.name ?? rec.name ?? undefined,
            });
          } else {
            onCommit(nextUrl);
          }
        }}
      />
    </span>
  );
}
