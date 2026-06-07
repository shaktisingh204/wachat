'use client';

import { Variable, Plus, X, GripVertical, Code } from 'lucide-react';

import {
  Button,
  IconButton,
  Card,
  CardBody,
  Label,
  Input,
  Textarea,
  Badge,
  EmptyState,
  SegmentedControl,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  cn,
} from '@/components/sabcrm/20ui';

/* ── Types ───────────────────────────────────────────────── */

export type SetDataValueType = 'string' | 'number' | 'boolean' | 'json' | 'expression';

export interface DataEntry {
  id: string;
  key: string;
  value: string;
  valueType: SetDataValueType;
}

export type SetDataMode =
  | 'merge'     // merge new keys into existing item data
  | 'replace';  // replace all item data with these keys

export interface SetDataNodeConfig {
  mode: SetDataMode;
  entries: DataEntry[];
}

/** Output: the same item data enriched/replaced with the defined keys */
export type SetDataOutput = Record<string, unknown>;

export type SetDataNodeProps = {
  config: SetDataNodeConfig;
  onChange: (config: SetDataNodeConfig) => void;
  className?: string;
};

/* ── Helpers ─────────────────────────────────────────────── */

let _id = 0;
function makeEntry(key = '', value = '', valueType: SetDataValueType = 'string'): DataEntry {
  return { id: `se-${++_id}`, key, value, valueType };
}

const VALUE_TYPE_LABELS: Record<SetDataValueType, string> = {
  string:     'String',
  number:     'Number',
  boolean:    'Boolean',
  json:       'JSON',
  expression: 'Expression',
};

const MODE_ITEMS: ReadonlyArray<{ value: SetDataMode; label: string }> = [
  { value: 'merge', label: 'Merge' },
  { value: 'replace', label: 'Replace' },
];

const BOOL_ITEMS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'true', label: 'true' },
  { value: 'false', label: 'false' },
];

/* ── Component ───────────────────────────────────────────── */

export function SetDataNode({ config, onChange, className }: SetDataNodeProps) {
  const updateEntry = (id: string, field: keyof DataEntry, val: string) =>
    onChange({
      ...config,
      entries: config.entries.map((e) => (e.id === id ? { ...e, [field]: val } : e)),
    });

  const removeEntry = (id: string) =>
    onChange({ ...config, entries: config.entries.filter((e) => e.id !== id) });

  const addEntry = () =>
    onChange({ ...config, entries: [...config.entries, makeEntry()] });

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]">
          <Variable className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </div>
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--st-text)]">Set Data</p>
          <p className="text-[11px] text-[var(--st-text-tertiary)]">Set or overwrite key-value pairs in item data</p>
        </div>
      </div>

      {/* Mode */}
      <div className="space-y-1.5">
        <Label>Mode</Label>
        <SegmentedControl
          aria-label="Set data mode"
          fullWidth
          items={MODE_ITEMS}
          value={config.mode}
          onChange={(m) => onChange({ ...config, mode: m })}
        />
        <p className="text-[11px] text-[var(--st-text-tertiary)]">
          {config.mode === 'merge'
            ? 'Merge these keys into the item. Existing keys not listed here are kept.'
            : 'Replace all item data with only these keys.'}
        </p>
      </div>

      {/* Entries */}
      <div className="space-y-2">
        <Label>Key-Value Pairs</Label>

        {config.entries.length === 0 && (
          <EmptyState
            size="sm"
            icon={Variable}
            title="No entries yet"
            description="Click Add entry below to define your first key."
          />
        )}

        {config.entries.map((entry, idx) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            index={idx}
            onChange={updateEntry}
            onRemove={removeEntry}
          />
        ))}

        <Button variant="ghost" size="sm" iconLeft={Plus} onClick={addEntry}>
          Add entry
        </Button>
      </div>

      {/* Preview */}
      {config.entries.length > 0 && (
        <div className="space-y-1.5">
          <Label>Preview</Label>
          <pre className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-[11.5px] font-mono text-[var(--st-text-secondary)]">
            {buildPreview(config.entries)}
          </pre>
        </div>
      )}

      <OutputSchema
        accent="#fb923c"
        fields={[
          { key: '...keys', type: 'any', description: 'Each key defined above is available as output' },
        ]}
      />
    </div>
  );
}

/* ── Entry row ───────────────────────────────────────────── */

function EntryRow({
  entry,
  index,
  onChange,
  onRemove,
}: {
  entry: DataEntry;
  index: number;
  onChange: (id: string, field: keyof DataEntry, val: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Card variant="outlined" padding="sm">
      <CardBody className="space-y-2">
        {/* Header row */}
        <div className="flex items-center gap-2">
          <GripVertical className="h-3.5 w-3.5 text-[var(--st-text-tertiary)] shrink-0 cursor-grab" strokeWidth={2} aria-hidden="true" />
          <span className="text-[10.5px] font-mono text-[var(--st-text-tertiary)] shrink-0">{String(index + 1).padStart(2, '0')}</span>
          <div className="flex-1 min-w-0">
            <Input
              inputSize="sm"
              className="font-mono"
              aria-label={`Key for entry ${index + 1}`}
              value={entry.key}
              onChange={(e) => onChange(entry.id, 'key', e.target.value)}
              placeholder="key_name"
            />
          </div>
          {/* Type select */}
          <Select
            value={entry.valueType}
            onValueChange={(v) => onChange(entry.id, 'valueType', v)}
          >
            <SelectTrigger aria-label={`Value type for entry ${index + 1}`} className="shrink-0 w-[112px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(VALUE_TYPE_LABELS) as SetDataValueType[]).map((t) => (
                <SelectItem key={t} value={t}>{VALUE_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <IconButton
            label={`Remove entry ${index + 1}`}
            icon={X}
            variant="ghost"
            size="sm"
            onClick={() => onRemove(entry.id)}
          />
        </div>

        {/* Value input */}
        {entry.valueType === 'boolean' ? (
          <SegmentedControl
            aria-label={`Boolean value for entry ${index + 1}`}
            fullWidth
            items={BOOL_ITEMS}
            value={entry.value === 'true' ? 'true' : entry.value === 'false' ? 'false' : ''}
            onChange={(b) => onChange(entry.id, 'value', b)}
          />
        ) : entry.valueType === 'json' ? (
          <Textarea
            rows={4}
            className="font-mono text-[12px] resize-y"
            aria-label={`JSON value for entry ${index + 1}`}
            value={entry.value}
            onChange={(e) => onChange(entry.id, 'value', e.target.value)}
            placeholder='{ "key": "value" }'
            spellCheck={false}
          />
        ) : entry.valueType === 'expression' ? (
          <Input
            iconLeft={Code}
            className="font-mono text-[12px]"
            aria-label={`Expression value for entry ${index + 1}`}
            value={entry.value}
            onChange={(e) => onChange(entry.id, 'value', e.target.value)}
            placeholder="{{ $json.field + '_suffix' }}"
          />
        ) : (
          <Input
            type={entry.valueType === 'number' ? 'number' : 'text'}
            aria-label={`Value for entry ${index + 1}`}
            value={entry.value}
            onChange={(e) => onChange(entry.id, 'value', e.target.value)}
            placeholder={entry.valueType === 'number' ? '42' : 'value or {{variable}}'}
          />
        )}
      </CardBody>
    </Card>
  );
}

/* ── Preview builder ─────────────────────────────────────── */

function buildPreview(entries: DataEntry[]): string {
  const obj: Record<string, unknown> = {};
  for (const e of entries) {
    if (!e.key) continue;
    if (e.valueType === 'number') obj[e.key] = Number(e.value) || 0;
    else if (e.valueType === 'boolean') obj[e.key] = e.value === 'true';
    else if (e.valueType === 'json') {
      try { obj[e.key] = JSON.parse(e.value); } catch { obj[e.key] = e.value; }
    }
    else obj[e.key] = e.value;
  }
  return JSON.stringify(obj, null, 2);
}

/* ── Output schema ───────────────────────────────────────── */

type OutputField = { key: string; type: string; description: string };

function OutputSchema({ accent, fields }: { accent: string; fields: OutputField[] }) {
  return (
    <div className="space-y-1.5">
      <Label>Output</Label>
      <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)] divide-y divide-[var(--st-border)]">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center gap-2 px-3 py-1.5">
            <code className="min-w-[70px] text-[11.5px] font-mono font-medium" style={{ color: accent }}>{f.key}</code>
            <Badge tone="neutral" kind="soft" className="font-mono text-[10px]">{f.type}</Badge>
            <span className="flex-1 text-[11px] text-[var(--st-text-tertiary)] truncate">{f.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
