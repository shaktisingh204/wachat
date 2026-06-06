'use client';

/**
 * SabTables — main table view.
 *
 * Renders the grid by default and switches into kanban / gallery /
 * calendar / form layouts via the `<ViewSwitcher/>` segmented button.
 * Holds local optimistic record state so cell edits feel instant; the
 * server actions reconcile on success.
 */

import { useMemo, useState, useTransition } from 'react';
import {
  Plus,
  Settings2,
  Trash2,
  LayoutGrid,
  KanbanSquare,
  Image as ImageIcon,
  CalendarDays,
  ListFilter,
  Eye,
} from 'lucide-react';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogFooter,
  ZoruSheetContent,
  ZoruSheetHeader,
  ZoruSheetTitle,
  Sheet,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  cn,
} from '@/components/sabcrm/20ui/compat';
import {
  createSabtablesRecord,
  updateSabtablesRecord,
  deleteSabtablesRecord,
  addSabtablesField,
  deleteSabtablesField,
} from '@/app/actions/sabtables.actions';
import type {
  SabtablesField,
  SabtablesFieldType,
  SabtablesTableDoc,
} from '@/lib/rust-client/sabtables-tables';
import type { SabtablesRecordDoc } from '@/lib/rust-client/sabtables-records';
import type {
  SabtablesViewDoc,
  SabtablesViewKind,
} from '@/lib/rust-client/sabtables-views';

import { RecordDetailDrawer } from './record-detail-drawer';

interface Props {
  workspaceId: string;
  baseId: string;
  table: SabtablesTableDoc;
  initialRecords: SabtablesRecordDoc[];
  views: SabtablesViewDoc[];
}

const FIELD_TYPE_OPTIONS: { value: SabtablesFieldType; label: string }[] = [
  { value: 'text', label: 'Single line text' },
  { value: 'long_text', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percent', label: 'Percent' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & time' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'single_select', label: 'Single select' },
  { value: 'multi_select', label: 'Multi select' },
  { value: 'attachment', label: 'Attachment' },
  { value: 'link', label: 'Link to another table' },
  { value: 'lookup', label: 'Lookup' },
  { value: 'formula', label: 'Formula' },
  { value: 'rollup', label: 'Rollup' },
  { value: 'count', label: 'Count' },
  { value: 'user', label: 'User' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'rating', label: 'Rating' },
  { value: 'duration', label: 'Duration' },
  { value: 'autonumber', label: 'Autonumber' },
];

const VIEW_KINDS: { kind: SabtablesViewKind; label: string; Icon: typeof LayoutGrid }[] = [
  { kind: 'grid', label: 'Grid', Icon: LayoutGrid },
  { kind: 'kanban', label: 'Kanban', Icon: KanbanSquare },
  { kind: 'gallery', label: 'Gallery', Icon: ImageIcon },
  { kind: 'calendar', label: 'Calendar', Icon: CalendarDays },
  { kind: 'form', label: 'Form', Icon: Eye },
];

export function TableViewClient({
  workspaceId,
  baseId,
  table: initialTable,
  initialRecords,
  views: _views,
}: Props) {
  const [table, setTable] = useState(initialTable);
  const [records, setRecords] = useState(initialRecords);
  const [viewKind, setViewKind] = useState<SabtablesViewKind>('grid');
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [drawerRecordId, setDrawerRecordId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const primaryField = useMemo(
    () => table.fields.find((f) => f.id === table.primaryFieldId) ?? table.fields[0],
    [table],
  );

  const drawerRecord = useMemo(
    () => records.find((r) => r._id === drawerRecordId) ?? null,
    [records, drawerRecordId],
  );

  /* ────────── Cell edit ────────── */
  const setCell = (recordId: string, fieldId: string, value: unknown) => {
    setRecords((prev) =>
      prev.map((r) =>
        r._id === recordId
          ? { ...r, fieldsJson: { ...r.fieldsJson, [fieldId]: value } }
          : r,
      ),
    );
    startTransition(async () => {
      try {
        await updateSabtablesRecord(recordId, { fieldsJson: { [fieldId]: value } });
      } catch (err) {
        console.error('[sabtables] updateRecord failed', err);
      }
    });
  };

  /* ────────── New record ────────── */
  const handleAddRecord = () => {
    startTransition(async () => {
      try {
        const res = await createSabtablesRecord({ tableId: table._id, fieldsJson: {} });
        setRecords((prev) => [...prev, res.entity]);
      } catch (err) {
        console.error('[sabtables] createRecord failed', err);
      }
    });
  };

  /* ────────── Delete record ────────── */
  const handleDeleteRecord = (recordId: string) => {
    setRecords((prev) => prev.filter((r) => r._id !== recordId));
    startTransition(async () => {
      try {
        await deleteSabtablesRecord(recordId);
      } catch (err) {
        console.error('[sabtables] deleteRecord failed', err);
      }
    });
  };

  /* ────────── Add field ────────── */
  const handleAddField = async (name: string, fieldType: SabtablesFieldType) => {
    if (!name.trim()) return;
    const tmpField: SabtablesField = {
      id: `fld_tmp_${Date.now()}`,
      name: name.trim(),
      fieldType,
      isRequired: false,
    };
    try {
      const res = await addSabtablesField(workspaceId, baseId, table._id, {
        field: tmpField,
      });
      setTable(res);
      setAddFieldOpen(false);
    } catch (err) {
      console.error('[sabtables] addField failed', err);
    }
  };

  /* ────────── Delete field ────────── */
  const handleDeleteField = async (fieldId: string) => {
    try {
      const res = await deleteSabtablesField(workspaceId, baseId, table._id, fieldId);
      setTable(res);
    } catch (err) {
      console.error('[sabtables] deleteField failed', err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b px-3 py-2 flex items-center gap-2 flex-wrap">
        <ViewSwitcher kind={viewKind} onChange={setViewKind} />
        <div className="h-5 w-px bg-border mx-1" />
        <Button variant="ghost" size="sm">
          <ListFilter className="w-4 h-4 mr-1" /> Filter
        </Button>
        <Button variant="ghost" size="sm">
          <Settings2 className="w-4 h-4 mr-1" /> Configure
        </Button>
        <div className="flex-1" />
        <Button onClick={handleAddRecord} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add record
        </Button>
      </div>

      {/* View body */}
      <div className="flex-1 min-h-0 overflow-auto">
        {viewKind === 'grid' && (
          <GridView
            table={table}
            records={records}
            onCellChange={setCell}
            onAddField={() => setAddFieldOpen(true)}
            onDeleteField={handleDeleteField}
            onOpenRecord={(id) => setDrawerRecordId(id)}
            onDeleteRecord={handleDeleteRecord}
            primaryFieldId={primaryField?.id}
          />
        )}
        {viewKind === 'kanban' && (
          <KanbanPlaceholder records={records} fields={table.fields} />
        )}
        {viewKind === 'gallery' && (
          <GalleryView records={records} fields={table.fields} primary={primaryField} />
        )}
        {viewKind === 'calendar' && <CalendarPlaceholder />}
        {viewKind === 'form' && <FormViewBuilder tableId={table._id} fields={table.fields} />}
      </div>

      <AddFieldDialog
        open={addFieldOpen}
        onClose={() => setAddFieldOpen(false)}
        onSubmit={handleAddField}
      />

      <RecordDetailDrawer
        open={!!drawerRecord}
        record={drawerRecord}
        table={table}
        onClose={() => setDrawerRecordId(null)}
        onCellChange={setCell}
      />
    </div>
  );
}

/* ──────────────────────────────────── Sub-views ───────────────────────────── */

function ViewSwitcher({
  kind,
  onChange,
}: {
  kind: SabtablesViewKind;
  onChange: (k: SabtablesViewKind) => void;
}) {
  return (
    <div className="inline-flex border rounded-md overflow-hidden">
      {VIEW_KINDS.map(({ kind: k, label, Icon }) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={cn(
            'px-2.5 py-1.5 text-sm inline-flex items-center gap-1 border-r last:border-r-0',
            kind === k
              ? 'bg-zoru-ink text-white'
              : 'bg-zoru-surface text-zoru-ink-muted hover:text-zoru-ink',
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

interface GridProps {
  table: SabtablesTableDoc;
  records: SabtablesRecordDoc[];
  primaryFieldId?: string;
  onCellChange: (recordId: string, fieldId: string, value: unknown) => void;
  onAddField: () => void;
  onDeleteField: (fieldId: string) => void;
  onOpenRecord: (recordId: string) => void;
  onDeleteRecord: (recordId: string) => void;
}

function GridView({
  table,
  records,
  onCellChange,
  onAddField,
  onDeleteField,
  onOpenRecord,
  onDeleteRecord,
  primaryFieldId,
}: GridProps) {
  return (
    <table className="min-w-full text-sm border-separate border-spacing-0">
      <thead className="sticky top-0 bg-zoru-surface-2/50 z-10">
        <tr>
          <th className="w-8 px-2 py-2 border-b border-r text-left text-zoru-ink-muted">
            #
          </th>
          {table.fields.map((f) => (
            <th
              key={f.id}
              className="px-3 py-2 border-b border-r text-left font-medium whitespace-nowrap min-w-[160px] group"
            >
              <div className="flex items-center justify-between gap-2">
                <span>
                  {f.name}
                  {f.id === primaryFieldId ? (
                    <span className="ml-1 text-xs text-zoru-ink-muted">(primary)</span>
                  ) : null}
                </span>
                {f.id !== primaryFieldId ? (
                  <button
                    type="button"
                    onClick={() => onDeleteField(f.id)}
                    className="opacity-0 group-hover:opacity-100 text-zoru-ink-muted hover:text-zoru-ink"
                    aria-label={`Delete field ${f.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-zoru-ink-muted">
                {f.fieldType}
              </div>
            </th>
          ))}
          <th className="px-2 py-2 border-b text-left">
            <Button variant="ghost" size="sm" onClick={onAddField}>
              <Plus className="w-4 h-4 mr-1" /> Add field
            </Button>
          </th>
        </tr>
      </thead>
      <tbody>
        {records.map((r, idx) => (
          <tr key={r._id} className="hover:bg-zoru-surface-2/30 group">
            <td className="w-8 px-2 py-1 border-b border-r text-zoru-ink-muted text-xs">
              <button
                type="button"
                onClick={() => onOpenRecord(r._id)}
                className="hover:underline"
                aria-label={`Open record ${idx + 1}`}
              >
                {idx + 1}
              </button>
            </td>
            {table.fields.map((f) => (
              <td key={f.id} className="px-3 py-1 border-b border-r align-top">
                <Cell
                  field={f}
                  value={r.fieldsJson[f.id]}
                  onChange={(v) => onCellChange(r._id, f.id, v)}
                />
              </td>
            ))}
            <td className="px-2 py-1 border-b">
              <button
                type="button"
                onClick={() => onDeleteRecord(r._id)}
                className="opacity-0 group-hover:opacity-100 text-zoru-ink-muted hover:text-zoru-ink"
                aria-label="Delete record"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ──────────────────────────────────── Cell ────────────────────────────────── */

interface CellProps {
  field: SabtablesField;
  value: unknown;
  onChange: (value: unknown) => void;
}

function Cell({ field, value, onChange }: CellProps) {
  switch (field.fieldType) {
    case 'checkbox':
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case 'number':
    case 'currency':
    case 'percent':
    case 'rating':
    case 'duration':
    case 'autonumber':
      return (
        <input
          type="number"
          className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1"
          value={(value as number | undefined) ?? ''}
          onChange={(e) =>
            onChange(e.target.value === '' ? null : Number(e.target.value))
          }
        />
      );
    case 'date':
      return (
        <input
          type="date"
          className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1"
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
    case 'datetime':
      return (
        <input
          type="datetime-local"
          className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1"
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
    case 'long_text':
      return (
        <textarea
          rows={1}
          className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1 resize-none"
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'attachment':
      // Attachment cells delegate to SabFiles via the record drawer. In
      // the inline grid we just show a placeholder.
      return (
        <span className="text-xs text-zoru-ink-muted">
          {Array.isArray(value) ? `${(value as unknown[]).length} file(s)` : 'No files'}
        </span>
      );
    case 'formula':
    case 'lookup':
    case 'rollup':
    case 'count':
    case 'created_by':
    case 'created_at':
    case 'updated_by':
    case 'updated_at':
      // Computed / system fields are read-only.
      return (
        <span className="text-zoru-ink-muted">
          {value == null ? '—' : String(value)}
        </span>
      );
    default:
      return (
        <input
          type="text"
          className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1"
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

/* ──────────────────────────────── Other views ─────────────────────────────── */

function KanbanPlaceholder({
  records,
  fields,
}: {
  records: SabtablesRecordDoc[];
  fields: SabtablesField[];
}) {
  // Stack-by single_select field if available; otherwise show a single column.
  const stackBy = fields.find((f) => f.fieldType === 'single_select');
  const groups = useMemo(() => {
    if (!stackBy) return { Default: records };
    const out: Record<string, SabtablesRecordDoc[]> = {};
    for (const r of records) {
      const k = String(r.fieldsJson[stackBy.id] ?? 'Uncategorised');
      (out[k] ||= []).push(r);
    }
    return out;
  }, [records, stackBy]);

  return (
    <div className="p-4 grid grid-flow-col auto-cols-[280px] gap-3 overflow-x-auto">
      {Object.entries(groups).map(([k, rs]) => (
        <div key={k} className="border rounded-md bg-zoru-surface-2/30 flex flex-col">
          <div className="px-3 py-2 text-sm font-medium border-b">{k}</div>
          <div className="p-2 space-y-2 flex-1 min-h-[100px]">
            {rs.map((r) => (
              <div key={r._id} className="rounded-md bg-zoru-surface border p-2 text-sm">
                {fields.slice(0, 3).map((f) => (
                  <div key={f.id} className="truncate">
                    <span className="text-zoru-ink-muted text-xs">{f.name}: </span>
                    {String(r.fieldsJson[f.id] ?? '—')}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function GalleryView({
  records,
  fields,
  primary,
}: {
  records: SabtablesRecordDoc[];
  fields: SabtablesField[];
  primary?: SabtablesField;
}) {
  return (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {records.map((r) => (
        <div key={r._id} className="border rounded-md p-3 bg-zoru-surface">
          <div className="font-medium truncate">
            {primary ? String(r.fieldsJson[primary.id] ?? '(untitled)') : '(untitled)'}
          </div>
          <div className="mt-2 space-y-1 text-sm text-zoru-ink-muted">
            {fields.slice(1, 4).map((f) => (
              <div key={f.id} className="truncate">
                <span className="text-xs">{f.name}: </span>
                {String(r.fieldsJson[f.id] ?? '—')}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarPlaceholder() {
  return (
    <div className="p-10 text-center text-zoru-ink-muted">
      Calendar view — pick a date field in the view configurator to enable.
    </div>
  );
}

function FormViewBuilder({
  tableId,
  fields,
}: {
  tableId: string;
  fields: SabtablesField[];
}) {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div className="text-sm text-zoru-ink-muted">
        Form views generate a public share URL at <code>/sabtables/form/[formToken]</code>.
        Create one from the view configurator; this preview shows the fields that would
        be collected (table id <code>{tableId}</code>).
      </div>
      <div className="border rounded-md divide-y">
        {fields.map((f) => (
          <div key={f.id} className="p-3">
            <div className="font-medium">{f.name}</div>
            <div className="text-xs text-zoru-ink-muted">{f.fieldType}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────── Add-field dialog ────────────────────────────── */

function AddFieldDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, fieldType: SabtablesFieldType) => void;
}) {
  const [name, setName] = useState('');
  const [fieldType, setFieldType] = useState<SabtablesFieldType>('text');
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Add field</ZoruDialogTitle>
        </ZoruDialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="field-name">Field name</Label>
            <Input
              id="field-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="field-type">Type</Label>
            <Select value={fieldType} onValueChange={(v) => setFieldType(v as SabtablesFieldType)}>
              <ZoruSelectTrigger id="field-type">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {FIELD_TYPE_OPTIONS.map((opt) => (
                  <ZoruSelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          </div>
        </div>
        <ZoruDialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSubmit(name, fieldType)}
            disabled={!name.trim()}
          >
            Add field
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}
