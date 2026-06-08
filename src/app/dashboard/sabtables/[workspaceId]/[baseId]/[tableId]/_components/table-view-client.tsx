'use client';

/**
 * SabTables - main table view.
 *
 * Renders the grid by default and switches into kanban / gallery /
 * calendar / form layouts via the segmented view switcher. Holds local
 * optimistic record state so cell edits feel instant; the server actions
 * reconcile on success.
 */

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
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
  Inbox,
  Zap,
  Rows3,
} from 'lucide-react';

import {
  Button,
  IconButton,
  SegmentedControl,
  type SegmentedItem,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Field,
  Input,
  Textarea,
  Checkbox,
  Badge,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/sabcrm/20ui';
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
  { value: 'datetime', label: 'Date and time' },
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

const VIEW_KINDS: SegmentedItem<SabtablesViewKind>[] = [
  { value: 'grid', label: 'Grid', icon: LayoutGrid },
  { value: 'kanban', label: 'Kanban', icon: KanbanSquare },
  { value: 'gallery', label: 'Gallery', icon: ImageIcon },
  { value: 'calendar', label: 'Calendar', icon: CalendarDays },
  { value: 'form', label: 'Form', icon: Eye },
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
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2">
        <SegmentedControl<SabtablesViewKind>
          items={VIEW_KINDS}
          value={viewKind}
          onChange={setViewKind}
          size="sm"
          aria-label="View layout"
        />
        <span className="mx-1 h-5 w-px bg-[var(--st-border)]" aria-hidden="true" />
        <Badge tone="neutral" kind="soft">
          <Rows3 className="h-3 w-3" aria-hidden="true" />
          <span className="tabular-nums">{records.length}</span>{' '}
          {records.length === 1 ? 'record' : 'records'}
        </Badge>
        <Button variant="ghost" size="sm" iconLeft={ListFilter}>
          Filter
        </Button>
        <Button variant="ghost" size="sm" iconLeft={Settings2}>
          Configure
        </Button>
        <div className="flex-1" />
        <Button asChild variant="ghost" size="sm">
          <Link
            href={`/dashboard/sabtables/${workspaceId}/${baseId}/${table._id}/automations`}
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
            Automations
          </Link>
        </Button>
        <Button variant="primary" onClick={handleAddRecord} size="sm" iconLeft={Plus}>
          Add record
        </Button>
      </div>

      {/* View body */}
      <div className="min-h-0 flex-1 overflow-auto">
        {viewKind === 'grid' && records.length === 0 && (
          <div className="mx-auto w-full max-w-2xl px-6 py-12">
            <Card variant="outlined">
              <EmptyState
                icon={Inbox}
                title="No records yet"
                description="Add your first record to start filling in this table, or add a field to shape its columns."
                action={
                  <Button variant="primary" iconLeft={Plus} onClick={handleAddRecord}>
                    Add record
                  </Button>
                }
              />
            </Card>
          </div>
        )}
        {viewKind === 'grid' && records.length > 0 && (
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
    <Table density="compact" stickyHeader className="min-w-full">
      <THead>
        <Tr>
          <Th className="w-8 text-[var(--st-text-secondary)]">#</Th>
          {table.fields.map((f) => (
            <Th key={f.id} className="whitespace-nowrap min-w-[160px] group">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {f.name}
                    {f.id === primaryFieldId ? (
                      <Badge tone="accent" kind="soft" className="ml-1.5">
                        primary
                      </Badge>
                    ) : null}
                  </span>
                  {f.id !== primaryFieldId ? (
                    <IconButton
                      label={`Delete field ${f.name}`}
                      icon={Trash2}
                      size="sm"
                      onClick={() => onDeleteField(f.id)}
                      className="opacity-0 group-hover:opacity-100"
                    />
                  ) : null}
                </div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--st-text-secondary)]">
                  {f.fieldType}
                </span>
              </div>
            </Th>
          ))}
          <Th>
            <Button variant="ghost" size="sm" onClick={onAddField} iconLeft={Plus}>
              Add field
            </Button>
          </Th>
        </Tr>
      </THead>
      <TBody>
        {records.map((r, idx) => (
          <Tr key={r._id} className="group">
            <Td className="w-8 text-[var(--st-text-secondary)] text-xs">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenRecord(r._id)}
                aria-label={`Open record ${idx + 1}`}
              >
                {idx + 1}
              </Button>
            </Td>
            {table.fields.map((f) => (
              <Td key={f.id} className="align-top">
                <Cell
                  field={f}
                  value={r.fieldsJson[f.id]}
                  onChange={(v) => onCellChange(r._id, f.id, v)}
                />
              </Td>
            ))}
            <Td>
              <IconButton
                label="Delete record"
                icon={Trash2}
                size="sm"
                onClick={() => onDeleteRecord(r._id)}
                className="opacity-0 group-hover:opacity-100"
              />
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
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
        <Checkbox
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={field.name}
        />
      );
    case 'number':
    case 'currency':
    case 'percent':
    case 'rating':
    case 'duration':
    case 'autonumber':
      return (
        <Input
          inputSize="sm"
          type="number"
          aria-label={field.name}
          value={(value as number | undefined) ?? ''}
          onChange={(e) =>
            onChange(e.target.value === '' ? null : Number(e.target.value))
          }
        />
      );
    case 'date':
      return (
        <Input
          inputSize="sm"
          type="date"
          aria-label={field.name}
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
    case 'datetime':
      return (
        <Input
          inputSize="sm"
          type="datetime-local"
          aria-label={field.name}
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
    case 'long_text':
      return (
        <Textarea
          rows={1}
          className="resize-none"
          aria-label={field.name}
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'attachment':
      // Attachment cells delegate to SabFiles via the record drawer. In
      // the inline grid we just show a placeholder.
      return (
        <span className="text-xs text-[var(--st-text-secondary)]">
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
        <span className="text-[var(--st-text-secondary)]">
          {value == null ? '-' : String(value)}
        </span>
      );
    default:
      return (
        <Input
          inputSize="sm"
          type="text"
          aria-label={field.name}
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
        <Card key={k} variant="outlined" padding="none" className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-sm">{k}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 flex-1 min-h-[100px]">
            {rs.map((r) => (
              <Card key={r._id} variant="outlined" padding="sm">
                {fields.slice(0, 3).map((f) => (
                  <div key={f.id} className="truncate text-sm">
                    <span className="text-[var(--st-text-secondary)] text-xs">{f.name}: </span>
                    {String(r.fieldsJson[f.id] ?? '-')}
                  </div>
                ))}
              </Card>
            ))}
          </CardBody>
        </Card>
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
        <Card key={r._id} variant="outlined" padding="md">
          <div className="font-medium truncate">
            {primary ? String(r.fieldsJson[primary.id] ?? '(untitled)') : '(untitled)'}
          </div>
          <div className="mt-2 space-y-1 text-sm text-[var(--st-text-secondary)]">
            {fields.slice(1, 4).map((f) => (
              <div key={f.id} className="truncate">
                <span className="text-xs">{f.name}: </span>
                {String(r.fieldsJson[f.id] ?? '-')}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function CalendarPlaceholder() {
  return (
    <div className="p-10">
      <EmptyState
        icon={CalendarDays}
        title="Calendar view"
        description="Pick a date field in the view configurator to enable the calendar."
      />
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
      <div className="text-sm text-[var(--st-text-secondary)]">
        Form views generate a public share URL at <code>/sabtables/form/[formToken]</code>.
        Create one from the view configurator; this preview shows the fields that would
        be collected (table id <code>{tableId}</code>).
      </div>
      {fields.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No fields yet"
          description="Add fields to the table to start collecting form responses."
        />
      ) : (
        <Card variant="outlined" padding="none">
          <div className="divide-y divide-[var(--st-border)]">
            {fields.map((f) => (
              <div key={f.id} className="p-3">
                <div className="font-medium">{f.name}</div>
                <div className="text-xs text-[var(--st-text-secondary)]">{f.fieldType}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add field</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Field name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Type">
            <Select value={fieldType} onValueChange={(v) => setFieldType(v as SabtablesFieldType)}>
              <SelectTrigger aria-label="Field type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => onSubmit(name, fieldType)}
            disabled={!name.trim()}
          >
            Add field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
