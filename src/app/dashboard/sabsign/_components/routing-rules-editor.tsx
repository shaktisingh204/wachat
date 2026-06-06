'use client';

/**
 * Conditional routing rules editor.
 *
 * Rules are evaluated server-side by `esign-envelopes::compute_next_signer`.
 * Each rule says "if field X matches Y, route next to signer Z".
 */

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
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
    <Card variant="outlined" padding="md" className="space-y-3">
      <CardHeader>
        <CardTitle>Conditional routing</CardTitle>
        <CardDescription>
          The first matching rule decides who signs next. Falls back to the
          lowest-order pending signer if none match.
        </CardDescription>
      </CardHeader>
      {rules.map((r, i) => (
        <div key={i} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_2fr_2fr_auto] gap-2 items-end">
          <Field label="Field">
            <Select value={r.fieldId} onValueChange={(value) => update(i, { fieldId: value })}>
              <SelectTrigger aria-label="Field">
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                {fields.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label || f.fieldType} ({f.recipientRole})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Op">
            <Select
              value={r.op}
              onValueChange={(value) => update(i, { op: value as RoutingRule['op'] })}
            >
              <SelectTrigger aria-label="Operator">
                <SelectValue placeholder="Operator" />
              </SelectTrigger>
              <SelectContent>
                {OPS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Value">
            <Input
              value={r.value || ''}
              onChange={(e) => update(i, { value: e.target.value })}
            />
          </Field>
          <Field label="Next signer">
            <Select
              value={r.nextSignerId}
              onValueChange={(value) => update(i, { nextSignerId: value })}
            >
              <SelectTrigger aria-label="Next signer">
                <SelectValue placeholder="Select signer" />
              </SelectTrigger>
              <SelectContent>
                {signers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name || s.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <IconButton
            label="Remove rule"
            icon={Trash2}
            variant="ghost"
            size="sm"
            onClick={() => remove(i)}
          />
        </div>
      ))}
      <Button size="sm" variant="outline" iconLeft={Plus} onClick={add}>
        Add rule
      </Button>
    </Card>
  );
}
