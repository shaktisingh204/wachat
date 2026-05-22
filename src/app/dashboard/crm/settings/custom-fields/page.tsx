'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Button,
  Checkbox,
  ZoruColorPicker,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
    Check,
    Download,
    Edit,
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
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isEditing ? 'Save changes' : 'Create field'}
        </ZoruButton>
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
                <ZoruLabel>Options</ZoruLabel>
                <ZoruButton
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={add}
                >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add option
                </ZoruButton>
            </div>
            {options.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                    Add at least one option for a select / multiselect field.
                </p>
            ) : (
                <div className="space-y-2">
                    {options.map((opt, idx) => (
                        <div
                            key={idx}
                            className="grid grid-cols-[1fr_1fr_120px_auto] items-center gap-2"
                        >
                            <ZoruInput
                                placeholder="Label"
                                value={opt.label}
                                onChange={(e) =>
                                    update(idx, { label: e.target.value })
                                }
                            />
                            <ZoruInput
                                placeholder="value (slug)"
                                value={opt.value}
                                onChange={(e) =>
                                    update(idx, { value: e.target.value })
                                }
                            />
                            <ZoruColorPicker
                                value={opt.color || '#999999'}
                                onChange={(c) => update(idx, { color: c })}
                            />
                            <ZoruButton
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(idx)}
                                aria-label="Remove option"
                            >
                                <X className="h-4 w-4" />
                            </ZoruButton>
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
    const { toast } = useZoruToast();

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
        <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="max-w-2xl">
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

                    <ZoruDialogHeader>
                        <ZoruDialogTitle>
                            {isEditing ? 'Edit custom field' : 'New custom field'}
                        </ZoruDialogTitle>
                    </ZoruDialogHeader>

                    <div className="max-h-[70vh] space-y-4 overflow-y-auto py-4 pr-1">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="entityKind">Entity *</ZoruLabel>
                                <ZoruSelect
                                    name="entityKind"
                                    required
                                    value={entityKind}
                                    onValueChange={setEntityKind}
                                >
                                    <ZoruSelectTrigger id="entityKind">
                                        <ZoruSelectValue placeholder="Pick an entity…" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {ENTITY_KINDS.map((e) => (
                                            <ZoruSelectItem
                                                key={e.value}
                                                value={e.value}
                                            >
                                                {e.label}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="fieldType">Field type *</ZoruLabel>
                                <ZoruSelect
                                    name="fieldType"
                                    required
                                    value={fieldType}
                                    onValueChange={(v) =>
                                        setFieldType(v as CrmCustomFieldType)
                                    }
                                >
                                    <ZoruSelectTrigger id="fieldType">
                                        <ZoruSelectValue placeholder="Pick a type…" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {FIELD_TYPES.map((t) => (
                                            <ZoruSelectItem
                                                key={t.value}
                                                value={t.value}
                                            >
                                                {t.label}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="label">Display label *</ZoruLabel>
                                <ZoruInput
                                    id="label"
                                    name="label"
                                    placeholder="e.g. Passport Number"
                                    required
                                    defaultValue={initialData?.label}
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="name">Internal name *</ZoruLabel>
                                <ZoruInput
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
                                <ZoruLabel htmlFor="placeholder">Placeholder</ZoruLabel>
                                <ZoruInput
                                    id="placeholder"
                                    name="placeholder"
                                    placeholder="Shown inside empty inputs"
                                    defaultValue={initialData?.placeholder ?? ''}
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="section">Section</ZoruLabel>
                                <ZoruInput
                                    id="section"
                                    name="section"
                                    placeholder="e.g. Identification"
                                    defaultValue={initialData?.section ?? ''}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <ZoruLabel htmlFor="helpText">Help text</ZoruLabel>
                            <ZoruTextarea
                                id="helpText"
                                name="helpText"
                                rows={2}
                                placeholder="A short hint shown below the field on forms."
                                defaultValue={initialData?.helpText ?? ''}
                            />
                        </div>

                        <div className="space-y-2">
                            <ZoruLabel htmlFor="displayOrder">Display order</ZoruLabel>
                            <ZoruInput
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
                        <div className="rounded-md border border-border p-3">
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                            <div className="rounded-md border border-border p-3">
                                <OptionsRepeater
                                    options={options}
                                    onChange={setOptions}
                                />
                            </div>
                        ) : null}

                        {showValidation ? (
                            <div className="rounded-md border border-border p-3">
                                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Validation
                                </p>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-2">
                                        <ZoruLabel htmlFor="validation.min">
                                            Min
                                        </ZoruLabel>
                                        <ZoruInput
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
                                        <ZoruLabel htmlFor="validation.max">
                                            Max
                                        </ZoruLabel>
                                        <ZoruInput
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
                                        <ZoruLabel htmlFor="validation.pattern">
                                            Regex pattern
                                        </ZoruLabel>
                                        <ZoruInput
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

                    <ZoruDialogFooter>
                        <ZoruButton
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </ZoruButton>
                        <SubmitButton isEditing={isEditing} />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
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
            <ZoruCheckbox
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
    const { toast } = useZoruToast();

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
                        <ZoruButton
                            key={e.value}
                            type="button"
                            size="sm"
                            variant={
                                activeEntity === e.value ? 'default' : 'outline'
                            }
                            onClick={() => setActiveEntity(e.value)}
                        >
                            {e.label}
                        </ZoruButton>
                    ))}
                </div>

                <EntityListShell
                    title="Custom Fields"
                    subtitle="Extend any CRM entity with user-defined fields, grouped by entity kind."
                    primaryAction={
                        <div className="flex items-center gap-2">
                            <ZoruButton
                                variant="outline"
                                onClick={handleExport}
                                disabled={filtered.length === 0}
                            >
                                <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
                            </ZoruButton>
                            <ZoruButton onClick={() => handleOpenDialog(null)}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New field
                            </ZoruButton>
                        </div>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search by label, name or section…',
                    }}
                    filters={
                        <div className="flex flex-wrap items-center gap-2">
                            <ZoruSelect
                                value={fieldTypeFilter}
                                onValueChange={setFieldTypeFilter}
                            >
                                <ZoruSelectTrigger className="h-9 w-[180px]">
                                    <ZoruSelectValue placeholder="Field type" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="all">All types</ZoruSelectItem>
                                    {FIELD_TYPES.map((t) => (
                                        <ZoruSelectItem key={t.value} value={t.value}>
                                            {t.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                            {(search || fieldTypeFilter !== 'all') && (
                                <ZoruButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setSearch(''); setFieldTypeFilter('all'); }}
                                >
                                    <X className="mr-1 h-3.5 w-3.5" /> Clear
                                </ZoruButton>
                            )}
                        </div>
                    }
                    loading={isLoading && fields.length === 0}
                >
                    {/* KPI strip */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-3">
                        <ZoruStatCard label="Total fields" value={totalFields.toLocaleString()} />
                        <ZoruStatCard label="Active" value={activeFieldsCount.toLocaleString()} />
                        <ZoruStatCard label="Required" value={requiredCount.toLocaleString()} />
                        <ZoruStatCard label="Select / multi" value={selectTypeCount.toLocaleString()} />
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-border">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-border hover:bg-transparent">
                                    <ZoruTableHead className="text-muted-foreground w-16 text-right">
                                        Order
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground">
                                        Label
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground">
                                        Type
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground text-center">
                                        Required
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground text-center">
                                        Unique
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground text-center">
                                        In list
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground">
                                        Status
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground text-right">
                                        Actions
                                    </ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-border">
                                        <ZoruTableCell
                                            colSpan={8}
                                            className="h-24 text-center"
                                        >
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : filtered.length === 0 ? (
                                    <ZoruTableRow className="border-border">
                                        <ZoruTableCell
                                            colSpan={8}
                                            className="h-24 text-center text-muted-foreground"
                                        >
                                            No custom fields for{' '}
                                            {labelForEntity(activeEntity)} yet.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    filtered.map((f) => (
                                        <ZoruTableRow
                                            key={String(f._id)}
                                            className="border-border"
                                        >
                                            <ZoruTableCell className="text-right font-mono text-foreground">
                                                {f.displayOrder ?? 0}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
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
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-foreground">
                                                {labelForType(f.fieldType)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-center">
                                                {f.required ? (
                                                    <Check className="mx-auto h-4 w-4 text-foreground" />
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        —
                                                    </span>
                                                )}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-center">
                                                {f.unique ? (
                                                    <Check className="mx-auto h-4 w-4 text-foreground" />
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        —
                                                    </span>
                                                )}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-center">
                                                {f.visibleInList ? (
                                                    <Check className="mx-auto h-4 w-4 text-foreground" />
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        —
                                                    </span>
                                                )}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
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
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                <ZoruButton
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        handleOpenDialog(f)
                                                    }
                                                    aria-label="Edit field"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </ZoruButton>
                                                <ZoruButton
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        setPendingDelete(f)
                                                    }
                                                    aria-label="Delete field"
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </ZoruButton>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ))
                                )}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                </EntityListShell>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>
                            Delete custom field?
                        </ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.label}&rdquo; will
                            remove this field from all{' '}
                            {labelForEntity(pendingDelete?.entityKind || '')}{' '}
                            forms. Existing stored values are preserved on each
                            record.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={handleDelete}
                            disabled={deletePending}
                        >
                            Delete
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
