'use client';

import { useCallback } from 'react';
import { createId } from '@paralleldrive/cuid2';
import {
  LuSheet,
  LuPlus,
  LuTrash2,
  LuTableProperties,
} from 'react-icons/lu';
import type { Block, Variable, GoogleSheetsOptions, SheetsExtractor, SheetsCellValue } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass, selectClass, Divider } from './shared/primitives';
import { VariableSelect } from './shared/VariableSelect';

/* ── Constants ───────────────────────────────────────────────────────────── */

type SheetsAction = NonNullable<GoogleSheetsOptions['action']>;

const ACTION_LABELS: Record<SheetsAction, string> = {
  get_data:   'Get data',
  insert_row: 'Insert a row',
  update_row: 'Update a row',
  delete_row: 'Delete a row',
};

const ACTIONS = Object.keys(ACTION_LABELS) as SheetsAction[];

/* ── Sub-components ──────────────────────────────────────────────────────── */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold text-[var(--gray-9)] uppercase tracking-wider">
      {children}
    </span>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[#f76808] hover:bg-[#f7680814] transition-colors"
    >
      <LuPlus className="h-3 w-3" strokeWidth={2.5} />
      {label}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove row"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--gray-8)] hover:bg-[var(--gray-4)] hover:text-red-400 transition-colors"
    >
      <LuTrash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
    </button>
  );
}

function ColInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      placeholder="A"
      maxLength={3}
      spellCheck={false}
      className={`${inputClass} w-[60px] shrink-0 font-mono text-center`}
    />
  );
}

/* ── Props ───────────────────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* ── Main component ──────────────────────────────────────────────────────── */

export function GoogleSheetsSettings({ block, onBlockChange, variables = [] }: Props) {
  const opts = (block.options ?? {}) as GoogleSheetsOptions;

  const spreadsheetId = opts.spreadsheetId ?? '';
  const sheetName     = opts.sheetName ?? '';
  const action        = opts.action;
  const referenceRow  = opts.referenceRow ?? '';
  const rowNumber     = opts.rowNumber ?? '';
  const extractors    = opts.extractors ?? [];
  const cellValues    = opts.cellValues ?? [];

  /* ── Updater ─────────────────────────────────────────────────────────── */

  const update = useCallback(
    (patch: Partial<GoogleSheetsOptions>) => {
      onBlockChange({ ...block, options: { ...opts, ...patch } });
    },
    [block, opts, onBlockChange],
  );

  const handleActionChange = (next: SheetsAction | '') => {
    update({
      action:      next === '' ? undefined : next,
      extractors:  [],
      cellValues:  [],
      referenceRow: undefined,
      rowNumber:   undefined,
    });
  };

  /* ── Extractor list (Get data) ───────────────────────────────────────── */

  const addExtractor = () =>
    update({ extractors: [...extractors, { id: createId(), column: '', variableId: undefined }] });

  const updateExtractor = (id: string, patch: Partial<Omit<SheetsExtractor, 'id'>>) =>
    update({ extractors: extractors.map((e) => (e.id === id ? { ...e, ...patch } : e)) });

  const removeExtractor = (id: string) =>
    update({ extractors: extractors.filter((e) => e.id !== id) });

  /* ── Cell-value list (Insert / Update) ──────────────────────────────── */

  const addCellValue = () =>
    update({ cellValues: [...cellValues, { id: createId(), column: '', value: '' }] });

  const updateCellValue = (id: string, patch: Partial<Omit<SheetsCellValue, 'id'>>) =>
    update({ cellValues: cellValues.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const removeCellValue = (id: string) =>
    update({ cellValues: cellValues.filter((c) => c.id !== id) });

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuSheet} title="Google Sheets" />

      {/* Spreadsheet ID */}
      <Field label="Spreadsheet ID">
        <input
          type="text"
          value={spreadsheetId}
          onChange={(e) => update({ spreadsheetId: e.target.value })}
          placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
          spellCheck={false}
          className={inputClass}
        />
        <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
          Found in the Google Sheets URL. Supports{' '}
          <code className="font-mono bg-[var(--gray-3)] px-1 rounded text-[#f76808]">
            {'{{variable}}'}
          </code>
          .
        </p>
      </Field>

      {/* Sheet name */}
      <Field label="Sheet name">
        <input
          type="text"
          value={sheetName}
          onChange={(e) => update({ sheetName: e.target.value })}
          placeholder="Sheet1"
          spellCheck={false}
          className={inputClass}
        />
      </Field>

      <Divider />

      {/* Action selector */}
      <Field label="Action">
        <div className="relative">
          <LuTableProperties
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--gray-8)]"
            strokeWidth={1.8}
          />
          <select
            value={action ?? ''}
            onChange={(e) => handleActionChange(e.target.value as SheetsAction | '')}
            className={`${selectClass} pl-8`}
          >
            <option value="">— choose action —</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
      </Field>

      {/* ── Get data ─────────────────────────────────────────────── */}
      {action === 'get_data' && (
        <>
          <Divider />
          <Field label="Reference row">
            <input
              type="text"
              value={referenceRow}
              onChange={(e) => update({ referenceRow: e.target.value })}
              placeholder='e.g. "A1" or {{rowVar}}'
              spellCheck={false}
              className={inputClass}
            />
            <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
              The row used to locate data. Accepts a cell reference like{' '}
              <code className="font-mono bg-[var(--gray-3)] px-1 rounded text-[#f76808]">A1</code>{' '}
              or a{' '}
              <code className="font-mono bg-[var(--gray-3)] px-1 rounded text-[#f76808]">
                {'{{variable}}'}
              </code>
              .
            </p>
          </Field>

          <Divider />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <SectionHeading>Column extractors</SectionHeading>
              <AddButton onClick={addExtractor} label="Add extractor" />
            </div>

            {extractors.length === 0 && (
              <p className="text-[11px] text-[var(--gray-8)] italic">
                No extractors yet — add one to map a column to a variable.
              </p>
            )}

            {/* column header labels */}
            {extractors.length > 0 && (
              <div className="flex gap-1.5 items-center px-0.5">
                <span className="w-[60px] shrink-0 text-[10px] text-[var(--gray-8)] text-center">Col</span>
                <span className="flex-1 text-[10px] text-[var(--gray-8)]">Save to variable</span>
                <span className="w-7 shrink-0" />
              </div>
            )}

            {extractors.map((ex) => (
              <div key={ex.id} className="flex gap-1.5 items-center">
                <ColInput
                  value={ex.column}
                  onChange={(v) => updateExtractor(ex.id, { column: v })}
                />
                <div className="flex-1">
                  <VariableSelect
                    variables={variables}
                    value={ex.variableId}
                    onChange={(id) => updateExtractor(ex.id, { variableId: id })}
                    placeholder="— select variable —"
                  />
                </div>
                <RemoveButton onClick={() => removeExtractor(ex.id)} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Insert a row ────────────────────────────────────────── */}
      {action === 'insert_row' && (
        <>
          <Divider />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <SectionHeading>Cell values</SectionHeading>
              <AddButton onClick={addCellValue} label="Add cell" />
            </div>

            {cellValues.length === 0 && (
              <p className="text-[11px] text-[var(--gray-8)] italic">
                No cells defined — add one to set column values for the new row.
              </p>
            )}

            {cellValues.length > 0 && (
              <div className="flex gap-1.5 items-center px-0.5">
                <span className="w-[60px] shrink-0 text-[10px] text-[var(--gray-8)] text-center">Col</span>
                <span className="flex-1 text-[10px] text-[var(--gray-8)]">Value or {'{{variable}}'}</span>
                <span className="w-7 shrink-0" />
              </div>
            )}

            {cellValues.map((cv) => (
              <div key={cv.id} className="flex gap-1.5 items-center">
                <ColInput
                  value={cv.column}
                  onChange={(v) => updateCellValue(cv.id, { column: v })}
                />
                <input
                  type="text"
                  value={cv.value}
                  onChange={(e) => updateCellValue(cv.id, { value: e.target.value })}
                  placeholder="Value or {{variable}}"
                  spellCheck={false}
                  className={`${inputClass} flex-1`}
                />
                <RemoveButton onClick={() => removeCellValue(cv.id)} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Update a row ────────────────────────────────────────── */}
      {action === 'update_row' && (
        <>
          <Divider />
          <Field label="Row number">
            <input
              type="text"
              value={rowNumber}
              onChange={(e) => update({ rowNumber: e.target.value })}
              placeholder="e.g. 2 or {{rowNumberVar}}"
              spellCheck={false}
              className={inputClass}
            />
            <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
              1-based row index. Supports{' '}
              <code className="font-mono bg-[var(--gray-3)] px-1 rounded text-[#f76808]">
                {'{{variable}}'}
              </code>
              .
            </p>
          </Field>

          <Divider />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <SectionHeading>Cell values</SectionHeading>
              <AddButton onClick={addCellValue} label="Add cell" />
            </div>

            {cellValues.length === 0 && (
              <p className="text-[11px] text-[var(--gray-8)] italic">
                No cells defined — add one to specify which columns to update.
              </p>
            )}

            {cellValues.length > 0 && (
              <div className="flex gap-1.5 items-center px-0.5">
                <span className="w-[60px] shrink-0 text-[10px] text-[var(--gray-8)] text-center">Col</span>
                <span className="flex-1 text-[10px] text-[var(--gray-8)]">New value or {'{{variable}}'}</span>
                <span className="w-7 shrink-0" />
              </div>
            )}

            {cellValues.map((cv) => (
              <div key={cv.id} className="flex gap-1.5 items-center">
                <ColInput
                  value={cv.column}
                  onChange={(v) => updateCellValue(cv.id, { column: v })}
                />
                <input
                  type="text"
                  value={cv.value}
                  onChange={(e) => updateCellValue(cv.id, { value: e.target.value })}
                  placeholder="New value or {{variable}}"
                  spellCheck={false}
                  className={`${inputClass} flex-1`}
                />
                <RemoveButton onClick={() => removeCellValue(cv.id)} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Delete a row ────────────────────────────────────────── */}
      {action === 'delete_row' && (
        <>
          <Divider />
          <Field label="Row number">
            <input
              type="text"
              value={rowNumber}
              onChange={(e) => update({ rowNumber: e.target.value })}
              placeholder="e.g. 2 or {{rowNumberVar}}"
              spellCheck={false}
              className={inputClass}
            />
            <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
              1-based row index of the row to delete. Supports{' '}
              <code className="font-mono bg-[var(--gray-3)] px-1 rounded text-[#f76808]">
                {'{{variable}}'}
              </code>
              .
            </p>
          </Field>
        </>
      )}
    </div>
  );
}
