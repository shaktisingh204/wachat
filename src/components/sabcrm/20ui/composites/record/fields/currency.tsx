'use client';

/**
 * RecordSurface fields — CURRENCY.
 *
 * Displays Intl-formatted money with a muted ISO code tag. Edits via an
 * amount input + currency-code select; round-trips Twenty's
 * `{ amountMicros, currencyCode }` shape when that's what was stored.
 */

import * as React from 'react';

import { Input } from '../../../field';
import { Select } from '../../../select';
import {
  EmptyValue,
  editorKeyHandler,
  isEmpty,
  parseCurrency,
  type FieldDisplayProps,
  type FieldEditorProps,
} from './shared';

const COMMON_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'INR',
  'AED',
  'JPY',
  'AUD',
  'CAD',
  'SGD',
  'CNY',
];

export function CurrencyDisplay({ value, fmt }: FieldDisplayProps): React.JSX.Element {
  if (isEmpty(value)) return <EmptyValue />;
  const money = parseCurrency(value);
  if (!money) return <span className="rc-text">{String(value)}</span>;
  return (
    <span className="rc-money">
      {fmt.currency(money.amount, money.code)}
      <span className="rc-money__code">{money.code}</span>
    </span>
  );
}

export function CurrencyEditor({
  value,
  onCommit,
  onCancel,
}: FieldEditorProps): React.JSX.Element {
  const parsed = React.useMemo(() => parseCurrency(value), [value]);
  const [amount, setAmount] = React.useState(
    parsed ? String(parsed.amount) : '',
  );
  const [code, setCode] = React.useState(parsed?.code ?? 'USD');

  const codeOptions = React.useMemo(() => {
    const codes = COMMON_CURRENCIES.includes(code)
      ? COMMON_CURRENCIES
      : [code, ...COMMON_CURRENCIES];
    return codes.map((c) => ({ value: c, label: c }));
  }, [code]);

  const commitWith = React.useCallback(
    (nextCode: string): void => {
      const text = amount.trim();
      if (text === '') {
        onCommit(null);
        return;
      }
      const n = Number(text);
      if (Number.isNaN(n)) {
        onCommit(value);
        return;
      }
      // Round-trip the stored shape: micros stay micros.
      if (parsed?.micros) {
        onCommit({
          amountMicros: Math.round(n * 1_000_000),
          currencyCode: nextCode,
        });
      } else {
        onCommit({ amount: n, currencyCode: nextCode });
      }
    },
    [amount, onCommit, parsed, value],
  );
  const commit = React.useCallback((): void => commitWith(code), [commitWith, code]);

  return (
    <span className="rc-editor-row">
      <Input
        autoFocus
        inputMode="decimal"
        inputSize="sm"
        className="rc-editor-input rc-editor-input--num"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={editorKeyHandler(commit, onCancel)}
        onBlur={(e) => {
          // Moving into the code select keeps the edit alive.
          const next = e.relatedTarget as Node | null;
          if (!next || !e.currentTarget.closest('.rc-editor-row')?.contains(next)) {
            commit();
          }
        }}
        aria-label="Amount"
      />
      <Select
        size="sm"
        block={false}
        value={code}
        onChange={(next) => {
          if (!next) return;
          setCode(next);
          // Picking a code commits immediately (pick = commit).
          commitWith(next);
        }}
        options={codeOptions}
        aria-label="Currency"
      />
    </span>
  );
}
