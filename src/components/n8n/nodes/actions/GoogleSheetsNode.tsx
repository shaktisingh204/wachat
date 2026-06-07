'use client';

import { useState } from 'react';
import { Sheet, Plus, X } from 'lucide-react';
import {
  cn,
  Field,
  Input,
  Card,
  CardTitle,
  Switch,
  Button,
  IconButton,
  EmptyState,
  RadioGroup,
  Radio,
  SegmentedControl,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';

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
  { id: 'read_row', label: 'Read Row', description: 'Find and read a single row' },
  { id: 'read_range', label: 'Read Range', description: 'Read multiple rows from a range' },
  { id: 'append_row', label: 'Append Row', description: 'Add a new row at the bottom' },
  { id: 'update_row', label: 'Update Row', description: 'Find and update an existing row' },
  { id: 'delete_row', label: 'Delete Row', description: 'Find and delete a row' },
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
        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]">
          <Sheet className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </div>
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--st-text)]">Google Sheets</p>
          <p className="text-[11px] text-[var(--st-text-secondary)]">Read and write spreadsheet data</p>
        </div>
      </div>

      {/* Operation selector */}
      <Field label="Operation">
        <RadioGroup
          aria-label="Operation"
          value={config.operation}
          onValueChange={(v) => onChange({ ...config, operation: v as GoogleSheetsOperation })}
          className="grid grid-cols-2 gap-1.5"
        >
          {OPERATIONS.map(({ id, label, description }) => (
            <Radio
              key={id}
              value={id}
              className={cn(
                'items-start rounded-[var(--st-radius)] border px-3 py-2',
                config.operation === id
                  ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)]'
                  : 'border-[var(--st-border)] bg-[var(--st-bg-secondary)]',
              )}
              label={
                <span className="block">
                  <span className="block text-[12px] font-semibold text-[var(--st-text)]">{label}</span>
                  <span className="mt-0.5 block text-[10.5px] text-[var(--st-text-secondary)]">{description}</span>
                </span>
              }
            />
          ))}
        </RadioGroup>
      </Field>

      {/* Config / Columns tabs */}
      <SegmentedControl
        aria-label="Section"
        fullWidth
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { value: 'config', label: 'Configuration' },
          { value: 'columns', label: 'Columns' },
        ]}
      />

      {/* Config tab */}
      {activeTab === 'config' && (
        <div className="space-y-3">
          {/* Spreadsheet ID */}
          <Field
            label="Spreadsheet ID"
            help={
              <>
                Found in the spreadsheet URL: /spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit
              </>
            }
          >
            <Input
              value={config.spreadsheetId}
              onChange={(e) => onChange({ ...config, spreadsheetId: e.target.value })}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
            />
          </Field>

          {/* Sheet name */}
          <Field label="Sheet / Tab Name">
            <Input
              value={config.sheetName}
              onChange={(e) => onChange({ ...config, sheetName: e.target.value })}
              placeholder="Sheet1 (leave empty for first sheet)"
            />
          </Field>

          {/* Range */}
          <Field label="Range" help="A1 notation range to operate on">
            <Input
              className="font-mono"
              value={config.range}
              onChange={(e) => onChange({ ...config, range: e.target.value })}
              placeholder="A1:Z1000"
            />
          </Field>

          {/* Lookup (for row-level ops that need to find a row) */}
          {isLookupOp && (
            <Card variant="outlined" padding="sm" className="space-y-3 bg-[var(--st-bg-secondary)]">
              <CardTitle className="text-[12px]">Row Lookup</CardTitle>
              <Field label="Lookup Column">
                <Input
                  value={config.lookupColumn}
                  onChange={(e) => onChange({ ...config, lookupColumn: e.target.value })}
                  placeholder="email"
                />
              </Field>
              <Field label="Lookup Value">
                <Input
                  value={config.lookupValue}
                  onChange={(e) => onChange({ ...config, lookupValue: e.target.value })}
                  placeholder="{{contact.email}}"
                />
              </Field>
            </Card>
          )}

          {/* Include headers toggle for range reads */}
          {config.operation === 'read_range' && (
            <Card variant="outlined" padding="sm" className="flex items-center justify-between bg-[var(--st-bg-secondary)]">
              <div>
                <p className="text-[12.5px] font-medium text-[var(--st-text)]">Include Header Row</p>
                <p className="text-[11px] text-[var(--st-text-secondary)]">Use row 1 as column names in output</p>
              </div>
              <Switch
                aria-label="Include header row"
                checked={config.includeHeaders}
                onCheckedChange={(v) => onChange({ ...config, includeHeaders: v })}
              />
            </Card>
          )}

          {/* Output variable */}
          <Field label="Save Result to Variable">
            <Input
              value={config.outputVariable}
              onChange={(e) => onChange({ ...config, outputVariable: e.target.value })}
              placeholder="{{sheetsResult}}"
            />
          </Field>
        </div>
      )}

      {/* Columns tab */}
      {activeTab === 'columns' && (
        <div className="space-y-3">
          <p className="text-[11.5px] text-[var(--st-text-secondary)]">
            {isWriteOp
              ? 'Map variables to sheet columns for writing.'
              : 'Map sheet columns to variables to capture their values.'}
          </p>

          {config.columns.length === 0 && (
            <EmptyState
              size="sm"
              icon={Sheet}
              title="No columns mapped yet"
              description={isWriteOp ? 'Add a mapping to write values into the sheet.' : 'Add a mapping to capture column values.'}
            />
          )}

          <div className="space-y-2">
            {config.columns.map((col) => (
              <div key={col.id} className="flex items-center gap-2">
                <Field label="" className="flex-1">
                  <Input
                    value={col.columnName}
                    onChange={(e) => updateColumn(col.id, 'columnName', e.target.value)}
                    placeholder="Column name"
                    aria-label="Column name"
                  />
                </Field>
                <span className="shrink-0 text-[var(--st-text-tertiary)]" aria-hidden="true">
                  {isWriteOp ? '<-' : '->'}
                </span>
                <Field label="" className="flex-1">
                  <Input
                    value={col.value}
                    onChange={(e) => updateColumn(col.id, 'value', e.target.value)}
                    placeholder={isWriteOp ? '{{variable}}' : '{{save.here}}'}
                    aria-label={isWriteOp ? 'Variable to write' : 'Variable to store into'}
                  />
                </Field>
                <IconButton
                  label="Remove column mapping"
                  icon={X}
                  size="sm"
                  onClick={() => removeColumn(col.id)}
                />
              </div>
            ))}
          </div>

          <Button variant="ghost" size="sm" iconLeft={Plus} onClick={addColumn}>
            Add column mapping
          </Button>
        </div>
      )}

      <OutputSchema
        fields={[
          { key: 'rows', type: 'array', description: 'Array of row objects keyed by column name' },
          { key: 'updatedRange', type: 'string', description: 'The range that was actually modified' },
          { key: 'rowIndex', type: 'number?', description: 'Zero-based index of affected row (row ops)' },
        ]}
      />
    </div>
  );
}

/* ── Shared primitives ───────────────────────────────────── */

type OutputField = { key: string; type: string; description: string };

function OutputSchema({ fields }: { fields: OutputField[] }) {
  return (
    <Field label="Output">
      <Card variant="outlined" padding="none" className="overflow-hidden">
        <Table density="compact" hover={false}>
          <THead>
            <Tr>
              <Th>Field</Th>
              <Th>Type</Th>
              <Th>Description</Th>
            </Tr>
          </THead>
          <TBody>
            {fields.map((f) => (
              <Tr key={f.key}>
                <Td>
                  <code className="font-mono text-[11.5px] font-medium text-[var(--st-status-ok)]">{f.key}</code>
                </Td>
                <Td>
                  <code className="rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] px-1 py-0.5 font-mono text-[10px] text-[var(--st-text-secondary)]">
                    {f.type}
                  </code>
                </Td>
                <Td truncate className="text-[11px] text-[var(--st-text-secondary)]">
                  {f.description}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Card>
    </Field>
  );
}
