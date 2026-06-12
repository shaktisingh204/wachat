'use client';

/**
 * RecordSurface fields — text family.
 *
 * TEXT / EMAIL / PHONE / LINK displays + editors, plus the two "long text"
 * types: RICH_TEXT_V2 (plain-text preview, textarea editor) and RAW_JSON
 * (pretty-printed preview, textarea editor).
 */

import * as React from 'react';
import { Link2 } from 'lucide-react';

import { Input, Textarea } from '../../../field';
import {
  EmptyValue,
  editorKeyHandler,
  isEmpty,
  linkLabel,
  multilineKeyHandler,
  parseRichText,
  toHref,
  asRecord,
  type FieldDisplayProps,
  type FieldEditorProps,
} from './shared';

/* =========================================================================
   Displays
   ========================================================================= */

export function TextDisplay({ value }: FieldDisplayProps): React.JSX.Element {
  if (isEmpty(value)) return <EmptyValue />;
  return <span className="rc-text">{String(value)}</span>;
}

export function EmailDisplay({ value }: FieldDisplayProps): React.JSX.Element {
  if (isEmpty(value)) return <EmptyValue />;
  const email = String(value);
  return (
    <a
      href={`mailto:${email}`}
      className="rc-link"
      onClick={(e) => e.stopPropagation()}
    >
      {email}
    </a>
  );
}

export function PhoneDisplay({ value }: FieldDisplayProps): React.JSX.Element {
  if (isEmpty(value)) return <EmptyValue />;
  const phone = String(value);
  return (
    <a
      href={`tel:${phone}`}
      className="rc-link"
      onClick={(e) => e.stopPropagation()}
    >
      {phone}
    </a>
  );
}

export function LinkDisplay({ value }: FieldDisplayProps): React.JSX.Element {
  if (isEmpty(value)) return <EmptyValue />;
  const url = String(value);
  return (
    <a
      href={toHref(url)}
      target="_blank"
      rel="noopener noreferrer"
      className="rc-link"
      title={url}
      onClick={(e) => e.stopPropagation()}
    >
      <Link2 size={12} aria-hidden="true" className="rc-link__icon" />
      {linkLabel(url)}
    </a>
  );
}

export function RichTextDisplay({ value }: FieldDisplayProps): React.JSX.Element {
  const text = parseRichText(value).trim();
  if (!text) return <EmptyValue />;
  return <span className="rc-richtext">{text}</span>;
}

export function RawJsonDisplay({ value }: FieldDisplayProps): React.JSX.Element {
  let text: string;
  try {
    text =
      typeof value === 'string'
        ? JSON.stringify(JSON.parse(value), null, 2)
        : JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  if (!text || text === 'null' || text === '{}' || text === '[]') {
    return <EmptyValue />;
  }
  return <pre className="rc-json">{text}</pre>;
}

/* =========================================================================
   Editors
   ========================================================================= */

/** Shared one-line text editor with a configurable input type. */
function LineEditor({
  value,
  onCommit,
  onCancel,
  type = 'text',
  inputMode,
}: FieldEditorProps & {
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}): React.JSX.Element {
  const [draft, setDraft] = React.useState(isEmpty(value) ? '' : String(value));
  const commit = (): void => onCommit(draft.trim() === '' ? null : draft.trim());
  return (
    <Input
      autoFocus
      type={type}
      inputMode={inputMode}
      inputSize="sm"
      className="rc-editor-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={editorKeyHandler(commit, onCancel)}
      onBlur={commit}
      aria-label="Edit value"
    />
  );
}

export function TextEditor(props: FieldEditorProps): React.JSX.Element {
  return <LineEditor {...props} />;
}

export function EmailEditor(props: FieldEditorProps): React.JSX.Element {
  return <LineEditor {...props} type="email" inputMode="email" />;
}

export function PhoneEditor(props: FieldEditorProps): React.JSX.Element {
  return <LineEditor {...props} type="tel" inputMode="tel" />;
}

export function LinkEditor(props: FieldEditorProps): React.JSX.Element {
  return <LineEditor {...props} inputMode="url" />;
}

/**
 * RICH_TEXT_V2 editor — plain markdown textarea. Preserves Twenty's composite
 * shape (`{ blocknote, markdown }`) when the stored value carried one.
 */
export function RichTextEditor({
  value,
  onCommit,
  onCancel,
}: FieldEditorProps): React.JSX.Element {
  const [draft, setDraft] = React.useState(parseRichText(value));
  const commit = (): void => {
    const text = draft.trim();
    const rec = asRecord(value);
    if (rec) {
      onCommit({ ...rec, markdown: text });
    } else {
      onCommit(text === '' ? null : text);
    }
  };
  return (
    <Textarea
      autoFocus
      rows={4}
      className="rc-editor-textarea"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={multilineKeyHandler(commit, onCancel)}
      onBlur={commit}
      aria-label="Edit text"
    />
  );
}

/**
 * RAW_JSON editor — textarea over the pretty-printed JSON. Commits parsed
 * JSON when the draft parses; otherwise commits the raw string untouched.
 */
export function RawJsonEditor({
  value,
  onCommit,
  onCancel,
}: FieldEditorProps): React.JSX.Element {
  const initial = React.useMemo(() => {
    try {
      return typeof value === 'string'
        ? JSON.stringify(JSON.parse(value), null, 2)
        : value == null
          ? ''
          : JSON.stringify(value, null, 2);
    } catch {
      return String(value ?? '');
    }
  }, [value]);
  const [draft, setDraft] = React.useState(initial);
  const commit = (): void => {
    const text = draft.trim();
    if (text === '') {
      onCommit(null);
      return;
    }
    try {
      onCommit(JSON.parse(text));
    } catch {
      onCommit(text);
    }
  };
  return (
    <Textarea
      autoFocus
      rows={5}
      className="rc-editor-textarea rc-editor-textarea--mono"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={multilineKeyHandler(commit, onCancel)}
      onBlur={commit}
      aria-label="Edit JSON"
      spellCheck={false}
    />
  );
}
