'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Checkbox, ColorPicker, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, Table, TBody, Td, Th, THead, Tr, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
    Check,
    Download,
    Edit,
    LayoutGrid,
    LoaderCircle,
    Plus,
    Trash2,
    X,
} from 'lucide-react';

/**
 * CRM Custom Fields — settings-style list grouped by `entity_kind`.
 *
 * A pill row at the top switches the active CRM entity (contact, deal,
 * lead, account, ticket, employee, vendor, item, project). The table
 * below is sorted by `display_order` ASC. The inline-create dialog
 * doubles as the edit dialog and provides structured UI for both the
 * select/multiselect option set AND the optional numeric/text
 * validation rules — no raw JSON paste boxes anywhere.
 *
 * All RBAC + persistence happens server-side in
 * `@/app/actions/crm-custom-fields.actions`.
 */

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill } from '@/components/crm/status-pill';

import {
    deleteCustomField,
    getCustomFields,
    saveCustomField,
} from '@/app/actions/crm-custom-fields.actions';
import type {
    CrmCustomFieldDoc,
    CrmCustomFieldOption,
    CrmCustomFieldType,
    CrmCustomFieldValidation,
} from '@/lib/rust-client/crm-custom-fields';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

/* ─── Constants ─────────────────────────────────────────────────── */

/** Entity tabs along the top — one pill per CRM entity. */
const ENTITY_KINDS: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'contact', label: 'Contacts' },
    { value: 'deal', label: 'Deals' },
    { value: 'lead', label: 'Leads' },
    { value: 'account', label: 'Accounts' },
    { value: 'ticket', label: 'Tickets' },
    { value: 'employee', label: 'Employees' },
    { value: 'vendor', label: 'Vendors' },
    { value: 'item', label: 'Items' },
    { value: 'project', label: 'Projects' },
];

const DEFAULT_ENTITY_KIND = ENTITY_KINDS[0]!.value;

/** All 13 field types supported by the Rust DTO. */
const FIELD_TYPES: ReadonlyArray<{ value: CrmCustomFieldType; label: string }> = [
    { value: 'text', label: 'Text' },
    { value: 'textarea', label: 'Long text' },
    { value: 'number', label: 'Number' },
    { value: 'currency', label: 'Currency' },
    { value: 'date', label: 'Date' },
    { value: 'datetime', label: 'Date & time' },
    { value: 'boolean', label: 'Yes / No' },
    { value: 'select', label: 'Single select' },
    { value: 'multiselect', label: 'Multi-select' },
    { value: 'url', label: 'URL' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'file', label: 'File' },
];

const OPTION_BEARING: ReadonlySet<CrmCustomFieldType> = new Set([
    'select',
    'multiselect',
]);

const VALIDATABLE: ReadonlySet<CrmCustomFieldType> = new Set([
    'text',
    'textarea',
    'number',
    'currency',
]);

/** Entity-kind label resolver — falls back to the raw value for unknown kinds. */
function labelForEntity(kind: string): string {
    return ENTITY_KINDS.find((e) => e.value === kind)?.label ?? kind;
}

/** Field-type label resolver — falls back to the raw value for unknown types. */
function labelForType(t: string): string {
    return FIELD_TYPES.find((f) => f.value === t)?.label ?? t;
}

/* ─── Dialog ───────────────────────────────────────────────────── */

const saveInitialState: { message?: string; error?: string; id?: string } = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isEditing ? 'Save changes' : 'Create field'}
        </Button>
    );
}

/**
 * Structured options repeater for select / multiselect field types.
 * Each row is `{ label, value, color }`; the parent receives the full
 * array and re-serialises it into the hidden form input.
 */
function OptionsRepeater({
    options,
    onChange,
}: {
    options: CrmCustomFieldOption[];
    onChange: (next: CrmCustomFieldOption[]) => void;
}) {
    const update = (idx: number, patch: Partial<CrmCustomFieldOption>) => {
        const next = options.map((o, i) => (i === idx ? { ...o, ...patch } : o));
        onChange(next);
    };

    const remove = (idx: number) => {
        onChange(options.filter((_, i) => i !== idx));
    };

    const add = () => {
        onChange([...options, { label: '', value: '', color: '' }]);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label>Options</Label>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={add}
                >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add option
                </Button>
            </div>
            {options.length === 0 ? (
                <p className="rounded-md border border-dashed border-[var(--st-border)] px-3 py-4 text-center text-xs text-[var(--st-text-secondary)]">
                    Add at least one option for a select / multiselect field.
                </p>
            ) : (
                <div className="space-y-2">
                    {options.map((opt, idx) => (
                        <div
                            key={idx}
                            className="grid grid-cols-[1fr_1fr_120px_auto] items-center gap-2"
                        >
                            <Input
                                placeholder="Label"
                                value={opt.label}
                                onChange={(e) =>
                                    update(idx, { label: e.target.value })
                                }
                            />
                            <Input
                                placeholder="value (slug)"
                                value={opt.value}
                                onChange={(e) =>
                                    update(idx, { value: e.target.value })
                                }
                            />
                            <ColorPicker
                                value={opt.color || '#999999'}
                                onChange={(c) => update(idx, { color: c })}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(idx)}
                                aria-label="Remove option"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function CustomFieldDialog({
    isOpen,
    onOpenChange,
    onSave,
    initialData,
    defaultEntityKind,
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
    initialData: CrmCustomFieldDoc | null;
    defaultEntityKind: string;
}) {
    const isEditing = !!initialData;
    const [state, formAction] = useActionState(
        saveCustomField,
        saveInitialState,
    );
    const { toast } = useToast();

    const [fieldType, setFieldType] = React.useState<CrmCustomFieldType>(
        (initialData?.fieldType as CrmCustomFieldType) || 'text',
    );
    const [entityKind, setEntityKind] = React.useState<string>(
        initialData?.entityKind || defaultEntityKind,
    );
    const [options, setOptions] = React.useState<CrmCustomFieldOption[]>(
        initialData?.options ? [...initialData.options] : [],
    );
    const [validation, setValidation] = React.useState<CrmCustomFieldValidation>(
        initialData?.validation ?? {},
    );

    // Reset form state every time the dialog re-opens with different data so
    // the user never sees stale values from the previous open.
    React.useEffect(() => {
        if (!isOpen) return;
        setFieldType(
            (initialData?.fieldType as CrmCustomFieldType) || 'text',
        );
        setEntityKind(initialData?.entityKind || defaultEntityKind);
        setOptions(initialData?.options ? [...initialData.options] : []);
        setValidation(initialData?.validation ?? {});
    }, [initialData, defaultEntityKind, isOpen]);

    React.useEffect(() => {
        if (state.message) {
            toast({ title: 'Success', description: state.message });
            onSave();
            onOpenChange(false);
        }
        if (state.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, onSave, onOpenChange]);

    const showOptions = OPTION_BEARING.has(fieldType);
    const showValidation = VALIDATABLE.has(fieldType);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <form action={formAction}>
                    {isEditing ? (
                        <input
                            type="hidden"
                            name="fieldId"
                            value={String(initialData!._id)}
                        />
                    ) : null}
                    {/* Hidden JSON payload for options — the action parses it. */}
                    <input
                        type="hidden"
                        name="optionsJson"
                        value={JSON.stringify(options)}
                    />

                    <DialogHeader>
                        <DialogTitle>
                            {isEditing ? 'Edit custom field' : 'New custom field'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="max-h-[70vh] space-y-4 overflow-y-auto py-4 pr-1">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="entityKind">Entity *</Label>
                                <Select
                                    name="entityKind"
                                    required
                                    value={entityKind}
                                    onValueChange={setEntityKind}
                                >
                                    <SelectTrigger id="entityKind">
                                        <SelectValue placeholder="Pick an entity…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ENTITY_KINDS.map((e) => (
                                            <SelectItem
                                                key={e.value}
                                                value={e.value}
                                            >
                                                {e.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="fieldType">Field type *</Label>
                                <Select
                                    name="fieldType"
                                    required
                                    value={fieldType}
                                    onValueChange={(v) =>
                                        setFieldType(v as CrmCustomFieldType)
                                    }
                                >
                                    <SelectTrigger id="fieldType">
                                        <SelectValue placeholder="Pick a type…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FIELD_TYPES.map((t) => (
                                            <SelectItem
                                                key={t.value}
                                                value={t.value}
                                            >
                                                {t.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="label">Display label *</Label>
                                <Input
                                    id="label"
                                    name="label"
                                    placeholder="e.g. Passport Number"
                                    required
                                    defaultValue={initialData?.label}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="name">Internal name *</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    placeholder="passport_number"
                                    required
                                    pattern="^[a-z][a-z0-9_]*$"
                                    title="Lowercase letters, digits, and underscores. Must start with a letter."
                                    className="font-mono"
                                    defaultValue={initialData?.name}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="placeholder">Placeholder</Label>
                                <Input
                                    id="placeholder"
                                    name="placeholder"
                                    placeholder="Shown inside empty inputs"
                                    defaultValue={initialData?.placeholder ?? ''}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="section">Section</Label>
                                <Input
                                    id="section"
                                    name="section"
                                    placeholder="e.g. Identification"
                                    defaultValue={initialData?.section ?? ''}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="helpText">Help text</Label>
                            <Textarea
                                id="helpText"
                                name="helpText"
                                rows={2}
                                placeholder="A short hint shown below the field on forms."
                                defaultValue={initialData?.helpText ?? ''}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="displayOrder">Display order</Label>
                            <Input
                                id="displayOrder"
                                name="displayOrder"
                                type="number"
                                min={0}
                                step={1}
                                defaultValue={initialData?.displayOrder ?? 0}
                            />
                        </div>

                        {/* Flag grid — checkbox + label rows. Each checkbox writes
                            `on` when checked so the action's `pickBool` parser
                            reads them correctly. */}
                        <div className="rounded-md border border-[var(--st-border)] p-3">
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                                Flags
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <FlagCheckbox
                                    name="required"
                                    label="Required"
                                    defaultChecked={initialData?.required ?? false}
                                />
                                <FlagCheckbox
                                    name="unique"
                                    label="Unique"
                                    defaultChecked={initialData?.unique ?? false}
                                />
                                <FlagCheckbox
                                    name="visibleInList"
                                    label="Visible in list"
                                    defaultChecked={
                                        initialData?.visibleInList ?? false
                                    }
                                />
                                <FlagCheckbox
                                    name="visibleInForm"
                                    label="Visible in form"
                                    defaultChecked={
                                        initialData?.visibleInForm ?? true
                                    }
                                />
                                <FlagCheckbox
                                    name="editableInForm"
                                    label="Editable in form"
                                    defaultChecked={
                                        initialData?.editableInForm ?? true
                                    }
                                />
                                <FlagCheckbox
                                    name="isActive"
                                    label="Active"
                                    defaultChecked={initialData?.isActive ?? true}
                                />
                            </div>
                        </div>

                        {showOptions ? (
                            <div className="rounded-md border border-[var(--st-border)] p-3">
                                <OptionsRepeater
                                    options={options}
                                    onChange={setOptions}
                                />
                            </div>
                        ) : null}

                        {showValidation ? (
                            <div className="rounded-md border border-[var(--st-border)] p-3">
                                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                                    Validation
                                </p>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="validation.min">
                                            Min
                                        </Label>
                                        <Input
                                            id="validation.min"
                                            name="validation.min"
                                            type="number"
                                            step="any"
                                            placeholder="—"
                                            defaultValue={
                                                typeof validation.min === 'number'
                                                    ? validation.min
                                                    : ''
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="validation.max">
                                            Max
                                        </Label>
                                        <Input
                                            id="validation.max"
                                            name="validation.max"
                                            type="number"
                                            step="any"
                                            placeholder="—"
                                            defaultValue={
                                                typeof validation.max === 'number'
                                                    ? validation.max
                                                    : ''
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="validation.pattern">
                                            Regex pattern
                                        </Label>
                                        <Input
                                            id="validation.pattern"
                                            name="validation.pattern"
                                            placeholder="^[A-Z0-9]+$"
                                            className="font-mono"
                                            defaultValue={
                                                typeof validation.pattern ===
                                                'string'
                                                    ? validation.pattern
                                                    : ''
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <SubmitButton isEditing={isEditing} />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Local helper — controlled Checkbox that posts `on` via a hidden
 * input when checked so the server action's `pickBool` parser works
 * without needing the underlying Radix primitive to be inside a form.
 */
function FlagCheckbox({
    name,
    label,
    defaultChecked,
}: {
    name: string;
    label: string;
    defaultChecked: boolean;
}) {
    const [checked, setChecked] = React.useState(defaultChecked);
    React.useEffect(() => {
        setChecked(defaultChecked);
    }, [defaultChecked]);
    return (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
                checked={checked}
                onCheckedChange={(v) => setChecked(v === true)}
            />
            {checked ? (
                <input type="hidden" name={name} value="on" />
            ) : null}
            <span>{label}</span>
        </label>
    );
}

/* ─── Page ──────────────────────────────────────────────────────── */

export default function CustomFieldsPage() {
    const [fields, setFields] = React.useState<CrmCustomFieldDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [activeEntity, setActiveEntity] =
        React.useState<string>(DEFAULT_ENTITY_KIND);
    const [search, setSearch] = React.useState('');
    const [fieldTypeFilter, setFieldTypeFilter] = React.useState<string>('all');
    const [editing, setEditing] = React.useState<CrmCustomFieldDoc | null>(null);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [pendingDelete, setPendingDelete] =
        React.useState<CrmCustomFieldDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        const data = await getCustomFields(activeEntity);
        setFields(data);
        setIsLoading(false);
    }, [activeEntity]);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return fields.filter((f) => {
            if (fieldTypeFilter !== 'all' && f.fieldType !== fieldTypeFilter) return false;
            if (!q) return true;
            return `${f.label} ${f.name} ${f.section ?? ''}`.toLowerCase().includes(q);
        });
    }, [fields, search, fieldTypeFilter]);

    // KPI derivations (over all loaded fields for the active entity)
    const totalFields = fields.length;
    const requiredCount = fields.filter((f) => f.required).length;
    // Per-entity counts across ALL fetched fields are entity-scoped — show entity-level breakdown
    // by counting how many of the 9 entity kinds have at least one field; cross-entity KPI
    // is not available here since we fetch one entity at a time, so we surface active-entity stats.
    const activeFieldsCount = fields.filter((f) => f.isActive).length;
    const selectTypeCount = fields.filter((f) => f.fieldType === 'select' || f.fieldType === 'multiselect').length;

    // Export CSV
    const handleExport = () => {
        const exportRows = filtered.map((f) => ({
            Label: f.label,
            'Internal name': f.name,
            Entity: labelForEntity(f.entityKind),
            Type: labelForType(f.fieldType),
            Required: f.required ? 'Yes' : 'No',
            Unique: f.unique ? 'Yes' : 'No',
            Active: f.isActive ? 'Yes' : 'No',
            Section: f.section ?? '',
            'Display order': f.displayOrder ?? 0,
        }));
        downloadCsv(
            `custom-fields-${activeEntity}-${dateStamp()}.csv`,
            Object.keys(exportRows[0] ?? {}),
            exportRows,
        );
        toast({ title: 'CSV exported' });
    };

    const handleOpenDialog = (field: CrmCustomFieldDoc | null) => {
        setEditing(field);
        setIsDialogOpen(true);
    };

    const handleDelete = () => {
        if (!pendingDelete) return;
        startDeleteTransition(async () => {
            const result = await deleteCustomField(String(pendingDelete._id));
            if (result.success) {
                toast({ title: 'Field deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error,
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <CustomFieldDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={refresh}
                initialData={editing}
                defaultEntityKind={activeEntity}
            />

            {/* Entity-kind pill row — acts as the tab switcher. */}
                <div className="flex flex-wrap items-center gap-2">
                    {ENTITY_KINDS.map((e) => (
                        <Button
                            key={e.value}
                            type="button"
                            size="sm"
                            variant={
                                activeEntity === e.value ? 'default' : 'outline'
                            }
                            onClick={() => setActiveEntity(e.value)}
                        >
                            {e.label}
                        </Button>
                    ))}
                </div>

                <EntityListShell
                    title="Custom Fields"
                    subtitle="Extend any CRM entity with user-defined fields, grouped by entity kind."
                    primaryAction={
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={handleExport}
                                disabled={filtered.length === 0}
                            >
                                <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
                            </Button>
                            <Button onClick={() => handleOpenDialog(null)}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New field
                            </Button>
                        </div>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search by label, name or section…',
                    }}
                    filters={
                        <div className="flex flex-wrap items-center gap-2">
                            <Select
                                value={fieldTypeFilter}
                                onValueChange={setFieldTypeFilter}
                            >
                                <SelectTrigger className="h-9 w-[180px]">
                                    <SelectValue placeholder="Field type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All types</SelectItem>
                                    {FIELD_TYPES.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {(search || fieldTypeFilter !== 'all') && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setSearch(''); setFieldTypeFilter('all'); }}
                                >
                                    <X className="mr-1 h-3.5 w-3.5" /> Clear
                                </Button>
                            )}
                        </div>
                    }
                    loading={isLoading && fields.length === 0}
                >
                    {/* KPI strip */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-3">
                        <StatCard label="Total fields" value={totalFields.toLocaleString()} />
                        <StatCard label="Active" value={activeFieldsCount.toLocaleString()} />
                        <StatCard label="Required" value={requiredCount.toLocaleString()} />
                        <StatCard label="Select / multi" value={selectTypeCount.toLocaleString()} />
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)] w-16 text-right">
                                        Order
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Label
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Type
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)] text-center">
                                        Required
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)] text-center">
                                        Unique
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)] text-center">
                                        In list
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Status
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)] text-right">
                                        Actions
                                    </Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {isLoading ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td
                                            colSpan={8}
                                            className="h-24 text-center"
                                        >
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                        </Td>
                                    </Tr>
                                ) : filtered.length === 0 ? (
                                    <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                        <Td
                                            colSpan={8}
                                            className="py-12 text-center"
                                        >
                                            <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
                                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                                                    <LayoutGrid className="h-6 w-6" />
                                                </div>
                                                <h3 className="mt-4 text-sm font-semibold text-[var(--st-text)]">
                                                    No Custom Fields Configured
                                                </h3>
                                                <p className="mt-2 text-xs text-[var(--st-text-secondary)]">
                                                    Configure tailor-made custom properties for your {labelForEntity(activeEntity)} records. You can define text fields, select lists, dates, and more.
                                                </p>
                                                <div className="mt-4">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleOpenDialog(null)}
                                                    >
                                                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                                                        Add first field
                                                    </Button>
                                                </div>
                                            </div>
                                        </Td>
                                    </Tr>
                                ) : (
                                    filtered.map((f) => (
                                        <Tr
                                            key={String(f._id)}
                                            className="border-[var(--st-border)]"
                                        >
                                            <Td className="text-right font-mono text-[var(--st-text)]">
                                                {f.displayOrder ?? 0}
                                            </Td>
                                            <Td>
                                                <EntityRowLink
                                                    href={`/dashboard/crm/settings/custom-fields/${String(f._id)}/edit`}
                                                    label={f.label}
                                                    subtitle={
                                                        <span className="font-mono">
                                                            {f.name}
                                                            {f.section ? (
                                                                <>
                                                                    {' · '}
                                                                    <span className="not-italic">
                                                                        {f.section}
                                                                    </span>
                                                                </>
                                                            ) : null}
                                                        </span>
                                                    }
                                                />
                                            </Td>
                                            <Td className="text-[var(--st-text)]">
                                                {labelForType(f.fieldType)}
                                            </Td>
                                            <Td className="text-center">
                                                {f.required ? (
                                                    <Check className="mx-auto h-4 w-4 text-[var(--st-text)]" />
                                                ) : (
                                                    <span className="text-[var(--st-text-secondary)]">
                                                        —
                                                    </span>
                                                )}
                                            </Td>
                                            <Td className="text-center">
                                                {f.unique ? (
                                                    <Check className="mx-auto h-4 w-4 text-[var(--st-text)]" />
                                                ) : (
                                                    <span className="text-[var(--st-text-secondary)]">
                                                        —
                                                    </span>
                                                )}
                                            </Td>
                                            <Td className="text-center">
                                                {f.visibleInList ? (
                                                    <Check className="mx-auto h-4 w-4 text-[var(--st-text)]" />
                                                ) : (
                                                    <span className="text-[var(--st-text-secondary)]">
                                                        —
                                                    </span>
                                                )}
                                            </Td>
                                            <Td>
                                                <StatusPill
                                                    label={
                                                        f.isActive
                                                            ? 'Active'
                                                            : 'Inactive'
                                                    }
                                                    tone={
                                                        f.isActive
                                                            ? 'green'
                                                            : 'neutral'
                                                    }
                                                />
                                            </Td>
                                            <Td className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        handleOpenDialog(f)
                                                    }
                                                    aria-label="Edit field"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        setPendingDelete(f)
                                                    }
                                                    aria-label="Delete field"
                                                >
                                                    <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                                </Button>
                                            </Td>
                                        </Tr>
                                    ))
                                )}
                            </TBody>
                        </Table>
                    </div>
                </EntityListShell>

            <AlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete custom field?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.label}&rdquo; will
                            remove this field from all{' '}
                            {labelForEntity(pendingDelete?.entityKind || '')}{' '}
                            forms. Existing stored values are preserved on each
                            record.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deletePending}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
