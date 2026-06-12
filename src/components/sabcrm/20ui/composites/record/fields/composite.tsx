'use client';

/**
 * RecordSurface fields — composite & multi-value family.
 *
 * FULL_NAME (first + last inputs), ADDRESS (stacked lines / 6-part grid),
 * EMAILS / PHONES (mailto / tel chip lists with add-remove list editors),
 * LINKS (anchor chips, url-per-row editor) and ARRAY (plain chips,
 * comma-separated editor). Value parsing is shared (./shared) and tolerates
 * every stored shape Twenty produced; editors round-trip the stored shape —
 * a Twenty composite stays a composite, a plain array stays an array.
 *
 * RAW_JSON + RICH_TEXT_V2 live in ./text, ACTOR in ./relation.
 */

import * as React from 'react';
import { Plus, X } from 'lucide-react';

import { Tag } from '../../../badge';
import { Button } from '../../../button';
import { Input } from '../../../field';
import {
  EmptyValue,
  asRecord,
  editorKeyHandler,
  isEmpty,
  linkLabel,
  parseAddress,
  parseAddressParts,
  parseFullName,
  parseFullNameParts,
  parseLinks,
  parsePhones,
  parseStringList,
  toHref,
  useAutoFocus,
  useBlurCommit,
  type FieldDisplayProps,
  type FieldEditorProps,
  type NormLink,
} from './shared';

/* =========================================================================
   FULL_NAME
   ========================================================================= */

export function FullNameDisplay({ value }: FieldDisplayProps): React.JSX.Element {
  const name = parseFullName(value).trim();
  if (!name) return <EmptyValue />;
  return <span className="rc-text">{name}</span>;
}

export function FullNameEditor({
  value,
  onCommit,
  onCancel,
}: FieldEditorProps): React.JSX.Element {
  const initial = parseFullNameParts(value);
  const [first, setFirst] = React.useState(initial.first);
  const [last, setLast] = React.useState(initial.last);

  const commit = (): void => {
    const f = first.trim();
    const l = last.trim();
    if (!f && !l) {
      onCommit(null);
      return;
    }
    const rec = asRecord(value);
    // Round-trip the stored key style: `{ first, last }` stays short-keyed;
    // everything else (including fresh values) uses Twenty's keys.
    if (rec && ('first' in rec || 'last' in rec)) {
      onCommit({ ...rec, first: f, last: l });
    } else {
      onCommit({ ...(rec ?? {}), firstName: f, lastName: l });
    }
  };
  const onBlur = useBlurCommit(commit);
  const ref = useAutoFocus<HTMLSpanElement>();

  return (
    <span ref={ref} className="rc-editor-row" onBlur={onBlur}>
      <Input
        inputSize="sm"
        className="rc-editor-input"
        value={first}
        onChange={(e) => setFirst(e.target.value)}
        onKeyDown={editorKeyHandler(commit, onCancel)}
        placeholder="First"
        aria-label="First name"
      />
      <Input
        inputSize="sm"
        className="rc-editor-input"
        value={last}
        onChange={(e) => setLast(e.target.value)}
        onKeyDown={editorKeyHandler(commit, onCancel)}
        placeholder="Last"
        aria-label="Last name"
      />
    </span>
  );
}

/* =========================================================================
   ADDRESS
   ========================================================================= */

export function AddressDisplay({ value }: FieldDisplayProps): React.JSX.Element {
  const lines = parseAddress(value);
  if (lines.length === 0) return <EmptyValue />;
  return (
    <span className="rc-stack">
      {lines.map((line, i) => (
        <span
          key={i}
          className={`rc-stack__line${i > 0 ? ' rc-stack__line--muted' : ''}`}
        >
          {line}
        </span>
      ))}
    </span>
  );
}

const ADDRESS_PART_DEFS: ReadonlyArray<{
  part: 'street' | 'street2' | 'city' | 'state' | 'postcode' | 'country';
  label: string;
  wide?: boolean;
}> = [
  { part: 'street', label: 'Street', wide: true },
  { part: 'street2', label: 'Street 2', wide: true },
  { part: 'city', label: 'City' },
  { part: 'state', label: 'State' },
  { part: 'postcode', label: 'Postcode' },
  { part: 'country', label: 'Country' },
];

export function AddressEditor({
  value,
  onCommit,
  onCancel,
}: FieldEditorProps): React.JSX.Element {
  const [parts, setParts] = React.useState(() => parseAddressParts(value));

  const commit = (): void => {
    const p = {
      street: parts.street.trim(),
      street2: parts.street2.trim(),
      city: parts.city.trim(),
      state: parts.state.trim(),
      postcode: parts.postcode.trim(),
      country: parts.country.trim(),
    };
    if (!Object.values(p).some(Boolean)) {
      onCommit(null);
      return;
    }
    const rec = asRecord(value);
    // Round-trip the stored key style: Twenty's `address*` keys stay Twenty;
    // short keys (and fresh values) use the simple shape.
    const twentyKeyed =
      !!rec &&
      ['addressStreet1', 'addressStreet2', 'addressCity', 'addressState', 'addressPostcode', 'addressCountry'].some(
        (k) => k in rec,
      );
    if (twentyKeyed) {
      onCommit({
        ...rec,
        addressStreet1: p.street,
        addressStreet2: p.street2,
        addressCity: p.city,
        addressState: p.state,
        addressPostcode: p.postcode,
        addressCountry: p.country,
      });
    } else {
      onCommit({ ...(rec ?? {}), ...p });
    }
  };
  const onBlur = useBlurCommit(commit);
  const ref = useAutoFocus<HTMLSpanElement>();

  return (
    <span ref={ref} className="rc-editor-grid" onBlur={onBlur}>
      {ADDRESS_PART_DEFS.map(({ part, label, wide }) => (
        <Input
          key={part}
          inputSize="sm"
          className={`rc-editor-input${wide ? ' rc-editor-input--wide' : ''}`}
          value={parts[part]}
          onChange={(e) => setParts((prev) => ({ ...prev, [part]: e.target.value }))}
          onKeyDown={editorKeyHandler(commit, onCancel)}
          placeholder={label}
          aria-label={label}
        />
      ))}
    </span>
  );
}

/* =========================================================================
   EMAILS / PHONES — chip displays + a shared string-list editor
   ========================================================================= */

export function EmailsDisplay({ value }: FieldDisplayProps): React.JSX.Element {
  const emails = parseStringList(value, 'primaryEmail', 'additionalEmails');
  if (emails.length === 0) return <EmptyValue />;
  return (
    <span className="rc-chips">
      {emails.map((email, i) => (
        <a
          key={`${email}-${i}`}
          href={`mailto:${email}`}
          className="rc-chip rc-chip--link"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="rc-chip__label">{email}</span>
        </a>
      ))}
    </span>
  );
}

export function PhonesDisplay({ value }: FieldDisplayProps): React.JSX.Element {
  const phones = parsePhones(value);
  if (phones.length === 0) return <EmptyValue />;
  return (
    <span className="rc-chips">
      {phones.map((phone, i) => (
        <a
          key={`${phone.dial}-${i}`}
          href={`tel:${phone.dial}`}
          className="rc-chip rc-chip--link"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="rc-chip__label">{phone.display}</span>
        </a>
      ))}
    </span>
  );
}

/** Two trimmed string lists with identical entries? (no-op edit detection) */
function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}

/**
 * Shared multi-row string editor (EMAILS / PHONES): one input per entry with
 * a remove ×, plus an Add row button. Enter on any input commits the whole
 * list, Escape cancels, focus leaving the editor commits (blur-commit).
 */
function StringListEditor({
  initial,
  onCommitItems,
  onCancel,
  itemLabel,
  type,
  inputMode,
}: {
  initial: string[];
  onCommitItems: (items: string[]) => void;
  onCancel: () => void;
  itemLabel: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}): React.JSX.Element {
  const [items, setItems] = React.useState<string[]>(
    initial.length > 0 ? initial : [''],
  );
  const commit = (): void =>
    onCommitItems(items.map((s) => s.trim()).filter(Boolean));
  const onBlur = useBlurCommit(commit);
  const ref = useAutoFocus<HTMLSpanElement>();

  return (
    <span ref={ref} className="rc-editor-stack" onBlur={onBlur}>
      {items.map((item, i) => (
        <span key={i} className="rc-editor-item">
          <Input
            inputSize="sm"
            type={type}
            inputMode={inputMode}
            className="rc-editor-input"
            value={item}
            onChange={(e) =>
              setItems((prev) => prev.map((s, j) => (j === i ? e.target.value : s)))
            }
            onKeyDown={editorKeyHandler(commit, onCancel)}
            aria-label={`${itemLabel} ${i + 1}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconLeft={X}
            aria-label={`Remove ${itemLabel.toLowerCase()} ${i + 1}`}
            onClick={() =>
              setItems((prev) =>
                prev.length === 1 ? [''] : prev.filter((_, j) => j !== i),
              )
            }
          />
        </span>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconLeft={Plus}
        className="rc-editor-add"
        onClick={() => setItems((prev) => [...prev, ''])}
      >
        Add {itemLabel.toLowerCase()}
      </Button>
    </span>
  );
}

export function EmailsEditor({
  value,
  onCommit,
  onCancel,
}: FieldEditorProps): React.JSX.Element {
  const initial = React.useMemo(
    () => parseStringList(value, 'primaryEmail', 'additionalEmails'),
    [value],
  );
  return (
    <StringListEditor
      initial={initial}
      itemLabel="Email"
      type="email"
      inputMode="email"
      onCancel={onCancel}
      onCommitItems={(items) => {
        if (sameList(items, initial)) {
          onCommit(value); // untouched — keep the stored shape byte-for-byte
          return;
        }
        if (items.length === 0) {
          onCommit(null);
          return;
        }
        const rec = asRecord(value);
        if (rec && ('primaryEmail' in rec || 'additionalEmails' in rec)) {
          onCommit({
            ...rec,
            primaryEmail: items[0],
            additionalEmails: items.slice(1),
          });
        } else {
          onCommit(items);
        }
      }}
    />
  );
}

export function PhonesEditor({
  value,
  onCommit,
  onCancel,
}: FieldEditorProps): React.JSX.Element {
  const initial = React.useMemo(
    () => parsePhones(value).map((p) => p.display),
    [value],
  );
  return (
    <StringListEditor
      initial={initial}
      itemLabel="Phone"
      type="tel"
      inputMode="tel"
      onCancel={onCancel}
      onCommitItems={(items) => {
        if (sameList(items, initial)) {
          onCommit(value); // untouched — keep calling-code parts intact
          return;
        }
        if (items.length === 0) {
          onCommit(null);
          return;
        }
        const rec = asRecord(value);
        if (rec && ('primaryPhoneNumber' in rec || 'additionalPhones' in rec)) {
          // Edited strings carry the +NN prefix inline, so the split calling
          // code parts are cleared (parsePhones tolerates the inline form).
          onCommit({
            ...rec,
            primaryPhoneNumber: items[0],
            primaryPhoneCallingCode: '',
            primaryPhoneCountryCode: '',
            additionalPhones: items.slice(1).map((number) => ({ number })),
          });
        } else {
          onCommit(items);
        }
      }}
    />
  );
}

/* =========================================================================
   LINKS
   ========================================================================= */

export function LinksDisplay({ value }: FieldDisplayProps): React.JSX.Element {
  const links = parseLinks(value).filter((l) => l.url || l.label);
  if (links.length === 0) return <EmptyValue />;
  return (
    <span className="rc-chips">
      {links.map((link, i) => {
        const text = link.label || (link.url ? linkLabel(link.url) : '');
        return link.url ? (
          <a
            key={`${link.url}-${i}`}
            href={toHref(link.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="rc-chip rc-chip--link"
            title={link.url}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="rc-chip__label">{text}</span>
          </a>
        ) : (
          <Tag key={`${text}-${i}`} className="rc-tag">
            {text}
          </Tag>
        );
      })}
    </span>
  );
}

export function LinksEditor({
  value,
  onCommit,
  onCancel,
}: FieldEditorProps): React.JSX.Element {
  const initial = React.useMemo(() => parseLinks(value), [value]);
  const [links, setLinks] = React.useState<NormLink[]>(
    initial.length > 0 ? initial : [{ url: '', label: '' }],
  );

  const commit = (): void => {
    const cleaned = links
      .map((l) => ({ url: l.url.trim(), label: l.label.trim() }))
      .filter((l) => l.url || l.label);
    if (
      cleaned.length === initial.length &&
      cleaned.every((l, i) => l.url === initial[i].url && l.label === initial[i].label)
    ) {
      onCommit(value); // untouched — keep the stored shape byte-for-byte
      return;
    }
    if (cleaned.length === 0) {
      onCommit(null);
      return;
    }
    const rec = asRecord(value);
    if (rec && ('primaryLinkUrl' in rec || 'secondaryLinks' in rec)) {
      onCommit({
        ...rec,
        primaryLinkUrl: cleaned[0].url,
        primaryLinkLabel: cleaned[0].label,
        secondaryLinks: cleaned.slice(1),
      });
    } else {
      onCommit(cleaned);
    }
  };
  const onBlur = useBlurCommit(commit);
  const ref = useAutoFocus<HTMLSpanElement>();

  return (
    <span ref={ref} className="rc-editor-stack" onBlur={onBlur}>
      {links.map((link, i) => (
        <span key={i} className="rc-editor-item">
          <Input
            inputSize="sm"
            inputMode="url"
            className="rc-editor-input"
            value={link.url}
            onChange={(e) =>
              setLinks((prev) =>
                prev.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)),
              )
            }
            onKeyDown={editorKeyHandler(commit, onCancel)}
            placeholder="example.com"
            aria-label={`Link ${i + 1} URL`}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconLeft={X}
            aria-label={`Remove link ${i + 1}`}
            onClick={() =>
              setLinks((prev) =>
                prev.length === 1
                  ? [{ url: '', label: '' }]
                  : prev.filter((_, j) => j !== i),
              )
            }
          />
        </span>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconLeft={Plus}
        className="rc-editor-add"
        onClick={() => setLinks((prev) => [...prev, { url: '', label: '' }])}
      >
        Add link
      </Button>
    </span>
  );
}

/* =========================================================================
   ARRAY
   ========================================================================= */

export function ArrayDisplay({ value }: FieldDisplayProps): React.JSX.Element {
  const arr = Array.isArray(value)
    ? value
    : isEmpty(value)
      ? []
      : String(value)
          .split(',')
          .map((s) => s.trim());
  const items = arr.map((v) => String(v)).filter((s) => s.length > 0);
  if (items.length === 0) return <EmptyValue />;
  return (
    <span className="rc-chips">
      {items.map((item, i) => (
        <Tag key={`${item}-${i}`} className="rc-tag">
          {item}
        </Tag>
      ))}
    </span>
  );
}

/** ARRAY edits as a comma-separated line; commits a trimmed string array. */
export function ArrayEditor({
  value,
  onCommit,
  onCancel,
}: FieldEditorProps): React.JSX.Element {
  const initial = React.useMemo(() => {
    const arr = Array.isArray(value)
      ? value.map((v) => String(v))
      : isEmpty(value)
        ? []
        : String(value)
            .split(',')
            .map((s) => s.trim());
    return arr.filter(Boolean).join(', ');
  }, [value]);
  const [draft, setDraft] = React.useState(initial);

  const commit = (): void => {
    const items = draft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onCommit(items.length === 0 ? null : items);
  };

  return (
    <Input
      autoFocus
      inputSize="sm"
      className="rc-editor-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={editorKeyHandler(commit, onCancel)}
      onBlur={commit}
      placeholder="one, two, three"
      aria-label="Edit list (comma-separated)"
    />
  );
}
