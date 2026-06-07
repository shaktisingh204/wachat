'use client';

import { Calendar } from 'lucide-react';
import type { Block, Variable } from '@/lib/sabflow/types';
import {
  Field,
  Input,
  Switch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/sabcrm/20ui';
import { VariableSelect } from './shared/VariableSelect';
import { PanelHeader } from './shared/primitives';

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

const DATE_FORMAT_OPTIONS = [
  { label: 'MM/DD/YYYY', value: 'MM/dd/yyyy' },
  { label: 'DD/MM/YYYY', value: 'dd/MM/yyyy' },
  { label: 'YYYY-MM-DD', value: 'yyyy-MM-dd' },
  { label: 'DD-MM-YYYY', value: 'dd-MM-yyyy' },
  { label: 'MM-DD-YYYY', value: 'MM-dd-yyyy' },
  { label: 'DD.MM.YYYY', value: 'dd.MM.yyyy' },
  { label: 'YYYY/MM/DD', value: 'yyyy/MM/dd' },
] as const;

export function DateInputSettings({ block, onBlockChange, variables = [] }: Props) {
  const options = block.options ?? {};

  const update = (patch: Record<string, unknown>) =>
    onBlockChange({ ...block, options: { ...options, ...patch } });

  const format =
    typeof options.format === 'string' ? options.format : 'MM/dd/yyyy';
  const minDate = String(options.minDate ?? '');
  const maxDate = String(options.maxDate ?? '');
  const hasTime = Boolean(options.hasTime ?? false);
  const variableId =
    typeof options.variableId === 'string' ? options.variableId : undefined;

  return (
    <div className="space-y-4">
      <PanelHeader icon={Calendar} title="Date Input" />

      <Field label="Date format">
        <Select value={format} onValueChange={(value) => update({ format: value })}>
          <SelectTrigger aria-label="Date format">
            <SelectValue placeholder="Select a date format" />
          </SelectTrigger>
          <SelectContent>
            {DATE_FORMAT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Include time toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wide">
          Include time
        </span>
        <Switch
          checked={hasTime}
          onCheckedChange={(next) => update({ hasTime: next })}
          aria-label="Include time"
        />
      </div>

      <Field label="Save answer to variable">
        <VariableSelect
          variables={variables}
          value={variableId}
          onChange={(id) => update({ variableId: id })}
        />
      </Field>

      <Collapsible defaultOpen>
        <CollapsibleTrigger>Validation</CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min date">
              <Input
                type={hasTime ? 'datetime-local' : 'date'}
                value={minDate}
                onChange={(e) => update({ minDate: e.target.value || undefined })}
                placeholder={hasTime ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DD'}
              />
            </Field>
            <Field label="Max date">
              <Input
                type={hasTime ? 'datetime-local' : 'date'}
                value={maxDate}
                onChange={(e) => update({ maxDate: e.target.value || undefined })}
                placeholder={hasTime ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DD'}
              />
            </Field>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
