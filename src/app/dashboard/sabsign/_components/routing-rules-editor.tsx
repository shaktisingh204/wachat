'use client';

/**
 * Conditional routing rules editor.
 *
 * Rules are evaluated server-side by `esign-envelopes::compute_next_signer`.
 * Each rule says "if field X matches Y, route next to signer Z".
 */

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, Label, Card } from '@/components/sabcrm/20ui';
import type { EnvelopeField, EnvelopeSigner, RoutingRule } from '@/lib/rust-client/esign-envelopes';

const OPS: Array<RoutingRule['op']> = ['equals', 'not_equals', 'contains', 'gt', 'lt', 'truthy'];

export interface RoutingRulesEditorProps {
  rules: RoutingRule[];
  signers: EnvelopeSigner[];
  fields: EnvelopeField[];
  onChange: (rules: RoutingRule[]) => void;
}

export function RoutingRulesEditor({
  rules,
  signers,
  fields,
  onChange,
}: RoutingRulesEditorProps) {
  const add = () => {
    onChange([
      ...rules,
      {
        fieldId: fields[0]?.id || '',
        op: 'equals',
        value: '',
        nextSignerId: signers[0]?.id || '',
      },
    ]);
  };
  const update = (i: number, patch: Partial<RoutingRule>) => {
    const out = [...rules];
    out[i] = { ...out[i], ...patch };
    onChange(out);
  };
  const remove = (i: number) => onChange(rules.filter((_, idx) => idx !== i));

  return (
    <Card className="p-4 border border-[var(--st-border)] space-y-3">
      <div>
        <h4 className="text-sm font-medium text-[var(--st-text)]">Conditional routing</h4>
        <p className="text-xs text-[var(--st-text-secondary)]">
          The first matching rule decides who signs next. Falls back to the
          lowest-order pending signer if none match.
        </p>
      </div>
      {rules.map((r, i) => (
        <div key={i} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_2fr_2fr_auto] gap-2">
          <div>
            <Label className="text-xs">Field</Label>
            <select
              className="w-full h-9 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-2 text-sm"
              value={r.fieldId}
              onChange={(e) => update(i, { fieldId: e.target.value })}
            >
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label || f.fieldType} ({f.recipientRole})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Op</Label>
            <select
              className="w-full h-9 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-2 text-sm"
              value={r.op}
              onChange={(e) => update(i, { op: e.target.value as RoutingRule['op'] })}
            >
              {OPS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Value</Label>
            <Input
              value={r.value || ''}
              onChange={(e) => update(i, { value: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Next signer</Label>
            <select
              className="w-full h-9 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-2 text-sm"
              value={r.nextSignerId}
              onChange={(e) => update(i, { nextSignerId: e.target.value })}
            >
              {signers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || s.role}
                </option>
              ))}
            </select>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="self-end text-[var(--st-text)]"
            onClick={() => remove(i)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add}>
        <Plus className="h-4 w-4 mr-1" />
        Add rule
      </Button>
    </Card>
  );
}
