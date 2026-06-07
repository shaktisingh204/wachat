'use client';

import { useCallback } from 'react';
import { createId } from '@paralleldrive/cuid2';
import { Sheet, Plus, Trash2, TableProperties } from 'lucide-react';
import type { Block, Variable, GoogleSheetsOptions, SheetsExtractor, SheetsCellValue } from '@/lib/sabflow/types';
import {
  Field,
  Input,
  Button,
  IconButton,
  EmptyState,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { VariableSelect } from './shared/VariableSelect';
import { CredentialSelect } from './shared/CredentialSelect';

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
    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">
      {children}
    </span>
  );
}

/** Single-letter column reference input (e.g. "A", "BC"). */
function ColInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  return (
    <Input
      inputSize="sm"
      type="text"
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      placeholder="A"
      maxLength={3}
      spellCheck={false}
      className="w-[60px] shrink-0 text-center font-mono"
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
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--st-border)] pb-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-accent)]">
          <Sheet className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Google Sheets
        </h3>
      </div>

      {/* Credentials */}
      <Field label="Google credential">
        <CredentialSelect
          credentialType="google_sheets"
          value={(opts as { credentialId?: string }).credentialId}
          onChange={(id) => onBlockChange({ ...block, options: { ...opts, credentialId: id } })}
        />
      </Field>

      <div className="h-px bg-[var(--st-border)]" />

      {/* Spreadsheet ID */}
      <Field
        label="Spreadsheet ID"
        help={
          <>
            Found in the Google Sheets URL. Supports{' '}
            <code className="rounded bg-[var(--st-bg-secondary)] px-1 font-mono text-[var(--st-text)]">
              {'{{variable}}'}
            </code>
            .
          </>
        }
      >
        <Input
          type="text"
          value={spreadsheetId}
          onChange={(e) => update({ spreadsheetId: e.target.value })}
          placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
          spellCheck={false}
        />
      </Field>

      {/* Sheet name */}
      <Field label="Sheet name">
        <Input
          type="text"
          value={sheetName}
          onChange={(e) => update({ sheetName: e.target.value })}
          placeholder="Sheet1"
          spellCheck={false}
        />
      </Field>

      <div className="h-px bg-[var(--st-border)]" />

      {/* Action selector */}
      <Field label="Action">
        <Select
          value={action ?? ''}
          onValueChange={(v) => handleActionChange(v as SheetsAction | '')}
        >
          <SelectTrigger aria-label="Action">
            <span className="flex items-center gap-2">
              <TableProperties className="h-3.5 w-3.5 text-[var(--st-text-tertiary)]" strokeWidth={1.8} aria-hidden="true" />
              <SelectValue placeholder="Choose action" />
            </span>
          </SelectTrigger>
          <SelectContent>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {ACTION_LABELS[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* ── Get data ─────────────────────────────────────────────── */}
      {action === 'get_data' && (
        <>
          <div className="h-px bg-[var(--st-border)]" />
          <Field
            label="Reference row"
            help={
              <>
                The row used to locate data. Accepts a cell reference like{' '}
                <code className="rounded bg-[var(--st-bg-secondary)] px-1 font-mono text-[var(--st-text)]">A1</code>{' '}
                or a{' '}
                <code className="rounded bg-[var(--st-bg-secondary)] px-1 font-mono text-[var(--st-text)]">
                  {'{{variable}}'}
                </code>
                .
              </>
            }
          >
            <Input
              type="text"
              value={referenceRow}
              onChange={(e) => update({ referenceRow: e.target.value })}
              placeholder='e.g. "A1" or {{rowVar}}'
              spellCheck={false}
            />
          </Field>

          <div className="h-px bg-[var(--st-border)]" />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <SectionHeading>Column extractors</SectionHeading>
              <Button variant="ghost" size="sm" iconLeft={Plus} onClick={addExtractor}>
                Add extractor
              </Button>
            </div>

            {extractors.length === 0 ? (
              <EmptyState
                size="sm"
                title="No extractors yet"
                description="Add one to map a column to a variable."
              />
            ) : (
              <>
                {/* column header labels */}
                <div className="flex items-center gap-1.5 px-0.5">
                  <span className="w-[60px] shrink-0 text-center text-[10px] text-[var(--st-text-tertiary)]">Col</span>
                  <span className="flex-1 text-[10px] text-[var(--st-text-tertiary)]">Save to variable</span>
                  <span className="w-7 shrink-0" />
                </div>

                {extractors.map((ex) => (
                  <div key={ex.id} className="flex items-center gap-1.5">
                    <ColInput
                      ariaLabel="Column reference"
                      value={ex.column}
                      onChange={(v) => updateExtractor(ex.id, { column: v })}
                    />
                    <div className="flex-1">
                      <VariableSelect
                        variables={variables}
                        value={ex.variableId}
                        onChange={(id) => updateExtractor(ex.id, { variableId: id })}
                        placeholder="Select variable"
                      />
                    </div>
                    <IconButton
                      label="Remove extractor"
                      icon={Trash2}
                      size="sm"
                      variant="ghost"
                      onClick={() => removeExtractor(ex.id)}
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* ── Insert a row ────────────────────────────────────────── */}
      {action === 'insert_row' && (
        <>
          <div className="h-px bg-[var(--st-border)]" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <SectionHeading>Cell values</SectionHeading>
              <Button variant="ghost" size="sm" iconLeft={Plus} onClick={addCellValue}>
                Add cell
              </Button>
            </div>

            {cellValues.length === 0 ? (
              <EmptyState
                size="sm"
                title="No cells defined"
                description="Add one to set column values for the new row."
              />
            ) : (
              <>
                <div className="flex items-center gap-1.5 px-0.5">
                  <span className="w-[60px] shrink-0 text-center text-[10px] text-[var(--st-text-tertiary)]">Col</span>
                  <span className="flex-1 text-[10px] text-[var(--st-text-tertiary)]">Value or {'{{variable}}'}</span>
                  <span className="w-7 shrink-0" />
                </div>

                {cellValues.map((cv) => (
                  <div key={cv.id} className="flex items-center gap-1.5">
                    <ColInput
                      ariaLabel="Column reference"
                      value={cv.column}
                      onChange={(v) => updateCellValue(cv.id, { column: v })}
                    />
                    <Input
                      inputSize="sm"
                      type="text"
                      aria-label="Cell value"
                      value={cv.value}
                      onChange={(e) => updateCellValue(cv.id, { value: e.target.value })}
                      placeholder="Value or {{variable}}"
                      spellCheck={false}
                      className="flex-1"
                    />
                    <IconButton
                      label="Remove cell"
                      icon={Trash2}
                      size="sm"
                      variant="ghost"
                      onClick={() => removeCellValue(cv.id)}
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* ── Update a row ────────────────────────────────────────── */}
      {action === 'update_row' && (
        <>
          <div className="h-px bg-[var(--st-border)]" />
          <Field
            label="Row number"
            help={
              <>
                1-based row index. Supports{' '}
                <code className="rounded bg-[var(--st-bg-secondary)] px-1 font-mono text-[var(--st-text)]">
                  {'{{variable}}'}
                </code>
                .
              </>
            }
          >
            <Input
              type="text"
              value={rowNumber}
              onChange={(e) => update({ rowNumber: e.target.value })}
              placeholder="e.g. 2 or {{rowNumberVar}}"
              spellCheck={false}
            />
          </Field>

          <div className="h-px bg-[var(--st-border)]" />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <SectionHeading>Cell values</SectionHeading>
              <Button variant="ghost" size="sm" iconLeft={Plus} onClick={addCellValue}>
                Add cell
              </Button>
            </div>

            {cellValues.length === 0 ? (
              <EmptyState
                size="sm"
                title="No cells defined"
                description="Add one to specify which columns to update."
              />
            ) : (
              <>
                <div className="flex items-center gap-1.5 px-0.5">
                  <span className="w-[60px] shrink-0 text-center text-[10px] text-[var(--st-text-tertiary)]">Col</span>
                  <span className="flex-1 text-[10px] text-[var(--st-text-tertiary)]">New value or {'{{variable}}'}</span>
                  <span className="w-7 shrink-0" />
                </div>

                {cellValues.map((cv) => (
                  <div key={cv.id} className="flex items-center gap-1.5">
                    <ColInput
                      ariaLabel="Column reference"
                      value={cv.column}
                      onChange={(v) => updateCellValue(cv.id, { column: v })}
                    />
                    <Input
                      inputSize="sm"
                      type="text"
                      aria-label="New cell value"
                      value={cv.value}
                      onChange={(e) => updateCellValue(cv.id, { value: e.target.value })}
                      placeholder="New value or {{variable}}"
                      spellCheck={false}
                      className="flex-1"
                    />
                    <IconButton
                      label="Remove cell"
                      icon={Trash2}
                      size="sm"
                      variant="ghost"
                      onClick={() => removeCellValue(cv.id)}
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* ── Delete a row ────────────────────────────────────────── */}
      {action === 'delete_row' && (
        <>
          <div className="h-px bg-[var(--st-border)]" />
          <Field
            label="Row number"
            help={
              <>
                1-based row index of the row to delete. Supports{' '}
                <code className="rounded bg-[var(--st-bg-secondary)] px-1 font-mono text-[var(--st-text)]">
                  {'{{variable}}'}
                </code>
                .
              </>
            }
          >
            <Input
              type="text"
              value={rowNumber}
              onChange={(e) => update({ rowNumber: e.target.value })}
              placeholder="e.g. 2 or {{rowNumberVar}}"
              spellCheck={false}
            />
          </Field>
        </>
      )}
    </div>
  );
}
