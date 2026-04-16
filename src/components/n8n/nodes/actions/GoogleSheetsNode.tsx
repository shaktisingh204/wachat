'use client';

import { useState } from 'react';
import { LuSheet, LuPlus, LuX, LuRefreshCw } from 'react-icons/lu';
import { cn } from '@/lib/utils';

/* ── Types ───────────────────────────────────────────────── */

export type GoogleSheetsOperation =
  | 'read_row'
  | 'read_range'
  | 'append_row'
  | 'update_row'
  | 'delete_row'
  | 'clear_range';

export interface ColumnMapping {
  id: string;
  /** Column header name in the sheet */
  columnName: string;
  /** Variable/value to map (write ops) or variable to store into (read ops) */
  value: string;
}

export interface GoogleSheetsNodeConfig {
  operation: GoogleSheetsOperation;
  /** Google Sheets spreadsheet ID from the URL */
  spreadsheetId: string;
  /** Sheet/tab name, defaults to first sheet if empty */
  sheetName: string;
  /**
   * A1 range notation for range operations, e.g. "A1:D10"
   * For row-level ops, this is used as the lookup range
   */
  range: string;
  /**
   * For read/update/delete: column name and value to locate the row
   * e.g. { column: 'email', value: '{{contact.email}}' }
   */
  lookupColumn: string;
  lookupValue: string;
  /** Column-to-variable mappings for read/write */
  columns: ColumnMapping[];
  /** Variable name to store result */
  outputVariable: string;
  /** For read_range: include header row in output */
  includeHeaders: boolean;
}

export interface GoogleSheetsOutput {
  rows: Array<Record<string, string>>;
  updatedRange: string;
  rowIndex?: number;
}

export type GoogleSheetsNodeProps = {
  config: GoogleSheetsNodeConfig;
  onChange: (config: GoogleSheetsNodeConfig) => void;
  className?: string;
};

/* ── Constants ───────────────────────────────────────────── */

const OPERATIONS: { id: GoogleSheetsOperation; label: string; description: string }[] = [
  { id: 'read_row',    label: 'Read Row',    description: 'Find and read a single row' },
  { id: 'read_range',  label: 'Read Range',  description: 'Read multiple rows from a range' },
  { id: 'append_row',  label: 'Append Row',  description: 'Add a new row at the bottom' },
  { id: 'update_row',  label: 'Update Row',  description: 'Find and update an existing row' },
  { id: 'delete_row',  label: 'Delete Row',  description: 'Find and delete a row' },
  { id: 'clear_range', label: 'Clear Range', description: 'Clear all values in a range' },
];

let _id = 0;
function makeColumn(columnName = '', value = ''): ColumnMapping {
  return { id: `col-${++_id}`, columnName, value };
}

const WRITE_OPS: GoogleSheetsOperation[] = ['append_row', 'update_row'];
const LOOKUP_OPS: GoogleSheetsOperation[] = ['read_row', 'update_row', 'delete_row'];

/* ── Component ───────────────────────────────────────────── */

export function GoogleSheetsNode({ config, onChange, className }: GoogleSheetsNodeProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'columns'>('config');

  const isWriteOp = WRITE_OPS.includes(config.operation);
  const isLookupOp = LOOKUP_OPS.includes(config.operation);
  const isReadOp = config.operation === 'read_row' || config.operation === 'read_range';

  const updateColumn = (id: string, field: keyof ColumnMapping, val: string) =>
    onChange({
      ...config,
      columns: config.columns.map((c) => (c.id === id ? { ...c, [field]: val } : c)),
    });

  const removeColumn = (id: string) =>
    onChange({ ...config, columns: config.columns.filter((c) => c.id !== id) });

  const addColumn = () =>
    onChange({ ...config, columns: [...config.columns, makeColumn()] });

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#22c55e]/10 text-[#22c55e]">
          <LuSheet className="h-4 w-4" strokeWidth={2} />
        </div>
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--gray-12)]">Google Sheets</p>
          <p className="text-[11px] text-[var(--gray-9)]">Read and write spreadsheet data</p>
        </div>
      </div>

      {/* Operation selector */}
      <div className="space-y-1.5">
        <Label>Operation</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {OPERATIONS.map(({ id, label, description }) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ ...config, operation: id })}
              className={cn(
                'rounded-lg border px-3 py-2 text-left transition-colors',
                config.operation === id
                  ? 'border-[#22c55e]/40 bg-[#22c55e]/8 text-[var(--gray-12)]'
                  : 'border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-10)] hover:border-[var(--gray-6)]',
              )}
            >
              <p className="text-[12px] font-semibold">{label}</p>
              <p className="text-[10.5px] text-[var(--gray-9)] mt-0.5">{description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Config / Columns tabs */}
      <div className="flex gap-1 rounded-lg bg-[var(--gray-3)] p-1">
        {(['config', 'columns'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={cn(
              'flex-1 rounded-md py-1.5 text-[12px] font-medium transition-colors capitalize',
              activeTab === t
                ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm'
                : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
            )}
          >
            {t === 'config' ? 'Configuration' : 'Columns'}
          </button>
        ))}
      </div>

      {/* Config tab */}
      {activeTab === 'config' && (
        <div className="space-y-3">
          {/* Spreadsheet ID */}
          <div className="space-y-1.5">
            <Label>Spreadsheet ID</Label>
            <input
              type="text"
              className={INPUT_CLS}
              value={config.spreadsheetId}
              onChange={(e) => onChange({ ...config, spreadsheetId: e.target.value })}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
            />
            <p className="text-[11px] text-[var(--gray-9)]">
              Found in the spreadsheet URL: /spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit
            </p>
          </div>

          {/* Sheet name */}
          <div className="space-y-1.5">
            <Label>Sheet / Tab Name</Label>
            <input
              type="text"
              className={INPUT_CLS}
              value={config.sheetName}
              onChange={(e) => onChange({ ...config, sheetName: e.target.value })}
              placeholder="Sheet1 (leave empty for first sheet)"
            />
          </div>

          {/* Range */}
          <div className="space-y-1.5">
            <Label>Range</Label>
            <input
              type="text"
              className={cn(INPUT_CLS, 'font-mono')}
              value={config.range}
              onChange={(e) => onChange({ ...config, range: e.target.value })}
              placeholder="A1:Z1000"
            />
            <p className="text-[11px] text-[var(--gray-9)]">A1 notation range to operate on</p>
          </div>

          {/* Lookup (for row-level ops that need to find a row) */}
          {isLookupOp && (
            <div className="space-y-3 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-3">
              <p className="text-[12px] font-semibold text-[var(--gray-11)]">Row Lookup</p>
              <div className="space-y-1.5">
                <Label>Lookup Column</Label>
                <input
                  type="text"
                  className={INPUT_CLS}
                  value={config.lookupColumn}
                  onChange={(e) => onChange({ ...config, lookupColumn: e.target.value })}
                  placeholder="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Lookup Value</Label>
                <input
                  type="text"
                  className={INPUT_CLS}
                  value={config.lookupValue}
                  onChange={(e) => onChange({ ...config, lookupValue: e.target.value })}
                  placeholder="{{contact.email}}"
                />
              </div>
            </div>
          )}

          {/* Include headers toggle for range reads */}
          {config.operation === 'read_range' && (
            <div className="flex items-center justify-between rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2.5">
              <div>
                <p className="text-[12.5px] font-medium text-[var(--gray-12)]">Include Header Row</p>
                <p className="text-[11px] text-[var(--gray-9)]">Use row 1 as column names in output</p>
              </div>
              <Toggle
                checked={config.includeHeaders}
                onChange={(v) => onChange({ ...config, includeHeaders: v })}
              />
            </div>
          )}

          {/* Output variable */}
          <div className="space-y-1.5">
            <Label>Save Result to Variable</Label>
            <input
              type="text"
              className={INPUT_CLS}
              value={config.outputVariable}
              onChange={(e) => onChange({ ...config, outputVariable: e.target.value })}
              placeholder="{{sheetsResult}}"
            />
          </div>
        </div>
      )}

      {/* Columns tab */}
      {activeTab === 'columns' && (
        <div className="space-y-3">
          <p className="text-[11.5px] text-[var(--gray-9)]">
            {isWriteOp
              ? 'Map variables to sheet columns for writing.'
              : 'Map sheet columns to variables to capture their values.'}
          </p>

          {config.columns.length === 0 && (
            <div className="rounded-lg border border-dashed border-[var(--gray-5)] py-6 text-center text-[12px] text-[var(--gray-9)]">
              <LuSheet className="mx-auto mb-2 h-5 w-5 opacity-30" strokeWidth={1.5} />
              No columns mapped yet
            </div>
          )}

          <div className="space-y-2">
            {config.columns.map((col) => (
              <div key={col.id} className="flex items-center gap-2">
                <input
                  type="text"
                  className={cn(INPUT_CLS, 'flex-1')}
                  value={col.columnName}
                  onChange={(e) => updateColumn(col.id, 'columnName', e.target.value)}
                  placeholder="Column name"
                />
                <span className="text-[var(--gray-8)] shrink-0">
                  {isWriteOp ? '←' : '→'}
                </span>
                <input
                  type="text"
                  className={cn(INPUT_CLS, 'flex-1')}
                  value={col.value}
                  onChange={(e) => updateColumn(col.id, 'value', e.target.value)}
                  placeholder={isWriteOp ? '{{variable}}' : '{{save.here}}'}
                />
                <button
                  type="button"
                  onClick={() => removeColumn(col.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--gray-8)] hover:text-red-500 transition-colors"
                >
                  <LuX className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addColumn}
            className="flex items-center gap-1.5 text-[12px] font-medium text-[#f76808] hover:text-[#e25c00] transition-colors"
          >
            <LuPlus className="h-3.5 w-3.5" strokeWidth={2} />
            Add column mapping
          </button>
        </div>
      )}

      <OutputSchema
        accent="#22c55e"
        fields={[
          { key: 'rows',         type: 'array',   description: 'Array of row objects keyed by column name' },
          { key: 'updatedRange', type: 'string',  description: 'The range that was actually modified' },
          { key: 'rowIndex',     type: 'number?', description: 'Zero-based index of affected row (row ops)' },
        ]}
      />
    </div>
  );
}

/* ── Shared primitives ───────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
      {children}
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 rounded-full transition-colors',
        checked ? 'bg-[#f76808]' : 'bg-[var(--gray-5)]',
      )}
    >
      <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  );
}

type OutputField = { key: string; type: string; description: string };

function OutputSchema({ accent, fields }: { accent: string; fields: OutputField[] }) {
  return (
    <div className="space-y-1.5">
      <Label>Output</Label>
      <div className="rounded-lg border border-dashed border-[var(--gray-5)] bg-[var(--gray-2)] divide-y divide-[var(--gray-4)]">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center gap-2 px-3 py-1.5">
            <code className="min-w-[90px] text-[11.5px] font-mono font-medium" style={{ color: accent }}>{f.key}</code>
            <span className="rounded bg-[var(--gray-4)] px-1 py-0.5 text-[10px] font-mono text-[var(--gray-9)]">{f.type}</span>
            <span className="flex-1 text-[11px] text-[var(--gray-9)] truncate">{f.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const INPUT_CLS =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-3)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors';
