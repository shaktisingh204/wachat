'use client';

import { LuCalendar } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { VariableSelect } from './shared/VariableSelect';
import {
  Field,
  PanelHeader,
  CollapsibleSection,
  inputClass,
  selectClass,
  toggleClass,
} from './shared/primitives';

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
      <PanelHeader icon={LuCalendar} title="Date Input" />

      <Field label="Date format">
        <select
          value={format}
          onChange={(e) => update({ format: e.target.value })}
          className={selectClass}
        >
          {DATE_FORMAT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>

      {/* Include time toggle */}
      <div className="flex items-center justify-between">
        <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
          Include time
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={hasTime}
          onClick={() => update({ hasTime: !hasTime })}
          className={toggleClass(hasTime)}
        >
          <span
            className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              hasTime ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <Field label="Save answer to variable">
        <VariableSelect
          variables={variables}
          value={variableId}
          onChange={(id) => update({ variableId: id })}
        />
      </Field>

      <CollapsibleSection title="Validation" defaultOpen>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min date">
            <input
              type={hasTime ? 'datetime-local' : 'date'}
              value={minDate}
              onChange={(e) => update({ minDate: e.target.value || undefined })}
              placeholder={hasTime ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DD'}
              className={inputClass}
            />
          </Field>
          <Field label="Max date">
            <input
              type={hasTime ? 'datetime-local' : 'date'}
              value={maxDate}
              onChange={(e) => update({ maxDate: e.target.value || undefined })}
              placeholder={hasTime ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DD'}
              className={inputClass}
            />
          </Field>
        </div>
      </CollapsibleSection>
    </div>
  );
}
