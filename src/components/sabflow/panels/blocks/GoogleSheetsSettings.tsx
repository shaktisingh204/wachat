'use client';

import { useCallback } from 'react';
import { LuSheet, LuPlus, LuTrash2 } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass, selectClass, Divider } from './shared/primitives';
import { VariableSelect } from './shared/VariableSelect';

/* ── Types ───────────────────────────────────────────────────────────────── */

type SheetsAction = 'get_row' | 'insert_row' | 'update_row' | 'delete_row';

interface ColumnMapping {
  id: string;
  /** Column letter, e.g. "A", "B", "C" */
  column: string;
  variableId?: string;
}

interface GoogleSheetsOptions {
  spreadsheetId?: string;
  sheetName?: string;
  action?: SheetsAction;
  /** Used for get / update / delete: filter column + value */
  filterColumn?: string;
  filterValue?: string;
  /** Column ↔ variable mappings */
  columnMappings?: ColumnMapping[];
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const ACTION_LABELS: Record<SheetsAction, string> = {
  get_row: 'Get row',
  insert_row: 'Insert row',
  update_row: 'Update row',
  delete_row: 'Delete row',
};

const ACTIONS = Object.keys(ACTION_LABELS) as SheetsAction[];

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
  const sheetName = opts.sheetName ?? '';
  const action = opts.action;
  const filterColumn = opts.filterColumn ?? '';
  const filterValue = opts.filterValue ?? '';
  const columnMappings: ColumnMapping[] = opts.columnMappings ?? [];

  const update = useCallback(
    (patch: Partial<GoogleSheetsOptions>) => {
      onBlockChange({ ...block, options: { ...opts, ...patch } });
    },
    [block, opts, onBlockChange],
  );

  const handleActionChange = (newAction: SheetsAction | '') => {
    update({ action: newAction === '' ? undefined : newAction, columnMappings: [] });
  };

  /* ── Column mappings ─────────────────────────────────────────────── */
  const addMapping = () =>
    update({
      columnMappings: [...columnMappings, { id: uid(), column: '', variableId: undefined }],
    });

  const updateMapping = (
    id: string,
    field: keyof Omit<ColumnMapping, 'id'>,
    val: string | undefined,
  ) =>
    update({
      columnMappings: columnMappings.map((m) =>
        m.id === id ? { ...m, [field]: val } : m,
      ),
    });

  const removeMapping = (id: string) =>
    update({ columnMappings: columnMappings.filter((m) => m.id !== id) });

  const needsFilter = action === 'get_row' || action === 'update_row' || action === 'delete_row';
  const showMappings = action === 'get_row' || action === 'insert_row' || action === 'update_row';

  const mappingLabel =
    action === 'get_row'
      ? 'Extract columns to variables'
      : 'Column values to write';

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuSheet} title="Google Sheets" />

      <Field label="Spreadsheet ID">
        <input
          type="text"
          value={spreadsheetId}
          onChange={(e) => update({ spreadsheetId: e.target.value })}
          placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
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

      <Field label="Sheet name">
        <input
          type="text"
          value={sheetName}
          onChange={(e) => update({ sheetName: e.target.value })}
          placeholder="Sheet1"
          className={inputClass}
        />
      </Field>

      <Divider />

      <Field label="Action">
        <select
          value={action ?? ''}
          onChange={(e) => handleActionChange(e.target.value as SheetsAction | '')}
          className={selectClass}
        >
          <option value="">— select action —</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a]}
            </option>
          ))}
        </select>
      </Field>

      {/* Filter row (get / update / delete) */}
      {needsFilter && (
        <>
          <Divider />
          <div className="space-y-2">
            <span className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
              Filter row
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={filterColumn}
                onChange={(e) => update({ filterColumn: e.target.value })}
                placeholder="Column (e.g. A)"
                className={`${inputClass} w-[100px] shrink-0 font-mono`}
              />
              <input
                type="text"
                value={filterValue}
                onChange={(e) => update({ filterValue: e.target.value })}
                placeholder="Value or {{variable}}"
                className={inputClass}
              />
            </div>
          </div>
        </>
      )}

      {/* Column mappings */}
      {showMappings && (
        <>
          <Divider />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
                {mappingLabel}
              </span>
              <button
                type="button"
                onClick={addMapping}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[#f76808] hover:bg-[#f7680814] transition-colors"
              >
                <LuPlus className="h-3 w-3" strokeWidth={2.5} />
                Add
              </button>
            </div>

            {columnMappings.length === 0 && (
              <p className="text-[11px] text-[var(--gray-8)] italic">No mappings yet.</p>
            )}

            {columnMappings.map((m) => (
              <div key={m.id} className="flex gap-1.5 items-center">
                <input
                  type="text"
                  value={m.column}
                  onChange={(e) => updateMapping(m.id, 'column', e.target.value)}
                  placeholder="Col"
                  className={`${inputClass} w-[72px] shrink-0 font-mono uppercase`}
                  maxLength={3}
                />
                <span className="shrink-0 text-[var(--gray-8)] text-[11px]">
                  {action === 'get_row' ? '→' : '='}
                </span>
                <div className="flex-1">
                  {action === 'get_row' ? (
                    <VariableSelect
                      variables={variables}
                      value={m.variableId}
                      onChange={(id) => updateMapping(m.id, 'variableId', id)}
                      placeholder="— save to variable —"
                    />
                  ) : (
                    <input
                      type="text"
                      value={m.variableId ?? ''}
                      onChange={(e) => updateMapping(m.id, 'variableId', e.target.value || undefined)}
                      placeholder="Value or {{variable}}"
                      className={inputClass}
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeMapping(m.id)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--gray-8)] hover:bg-[var(--gray-4)] hover:text-red-400 transition-colors"
                  aria-label="Remove mapping"
                >
                  <LuTrash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
