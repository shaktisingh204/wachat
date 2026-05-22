'use client';

import {
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFormField } from '@/components/crm/enum-form-field';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  GripVertical,
  LoaderCircle,
  Plus,
  Save,
  Trash2 } from 'lucide-react';

/**
 * <CrmFormForm /> — create + edit form for CRM lead-capture Forms.
 *
 * Binds to the `saveForm` server action via `useActionState`. Field rows
 * are submitted via native `fields[i][key]` form-encoded names (no JSON
 * blob) — the server action's `readFieldRows` decodes them.
 */

import { saveForm, type SaveFormState } from '@/app/actions/crm-forms.actions';
import type {
    CrmFormDoc,
    CrmFormFieldDef,
    CrmFormStatus,
} from '@/lib/rust-client/crm-forms';

const BASE = '/dashboard/crm/sales-crm/forms';


interface FieldRow extends CrmFormFieldDef {
    rowKey: string;
}

const DEFAULT_FIELDS: FieldRow[] = [
    {
        rowKey: 'default-name',
        name: 'name',
        label: 'Full name',
        type: 'text',
        required: true,
    },
    {
        rowKey: 'default-email',
        name: 'email',
        label: 'Email',
        type: 'email',
        required: true,
    },
];

interface CrmFormFormProps {
    initialData?: CrmFormDoc | null;
}

const initialState: SaveFormState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create form'}
        </Button>
    );
}

export function CrmFormForm({ initialData }: CrmFormFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveForm, initialState);

    const [status, setStatus] = useState<CrmFormStatus>(
        initialData?.status ?? 'draft',
    );

    const [fields, setFields] = useState<FieldRow[]>(() => {
        if (initialData?.fields?.length) {
            return initialData.fields.map((f, i) => ({
                ...f,
                rowKey: `${f.name}-${i}`,
            }));
        }
        return DEFAULT_FIELDS;
    });

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            if (id) router.push(`${BASE}/${id}`);
            else router.push(BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    const addField = () =>
        setFields((prev) => [
            ...prev,
            {
                rowKey: `field-${Date.now()}-${prev.length}`,
                name: `field_${prev.length + 1}`,
                label: '',
                type: 'text',
                required: false,
            },
        ]);

    const removeField = (idx: number) =>
        setFields((prev) => prev.filter((_, i) => i !== idx));

    const updateField = <K extends keyof FieldRow>(
        idx: number,
        key: K,
        value: FieldRow[K],
    ) =>
        setFields((prev) =>
            prev.map((f, i) => (i === idx ? { ...f, [key]: value } : f)),
        );

    const moveField = (idx: number, dir: -1 | 1) =>
        setFields((prev) => {
            const j = idx + dir;
            if (j < 0 || j >= prev.length) return prev;
            const copy = [...prev];
            [copy[idx], copy[j]] = [copy[j], copy[idx]];
            return copy;
        });

    const settings = (initialData?.settings ?? {}) as Record<string, unknown>;

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="formId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="status" value={status} />

                {/* Name + Slug */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="name">Form name *</Label>
                        <Input
                            id="name"
                            name="name"
                            required
                            placeholder="e.g. Contact us"
                            defaultValue={initialData?.name ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="slug">Slug</Label>
                        <Input
                            id="slug"
                            name="slug"
                            placeholder="auto-generated from name"
                            defaultValue={initialData?.slug ?? ''}
                        />
                    </div>
                </div>

                {/* Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            enumName="activeDraftArchived"
                            name="status"
                            initialId={status}
                            onChange={(v) => setStatus((v ?? 'draft') as CrmFormStatus)}
                        />
                    </div>
                </div>

                {/* Fields repeater */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Fields *</Label>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={addField}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add field
                        </Button>
                    </div>
                    {fields.length === 0 ? (
                        <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                            At least one field is required.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {fields.map((f, idx) => (
                                <div
                                    key={f.rowKey}
                                    className="grid grid-cols-1 gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3 sm:grid-cols-[auto_1fr_1fr_140px_auto_1fr_auto]"
                                >
                                    <div className="flex flex-col items-center justify-center gap-1 self-center">
                                        <button
                                            type="button"
                                            onClick={() => moveField(idx, -1)}
                                            disabled={idx === 0}
                                            className="text-zoru-ink-muted hover:text-zoru-ink disabled:opacity-30"
                                            aria-label="Move up"
                                        >
                                            <GripVertical className="h-4 w-4" />
                                        </button>
                                        <span className="font-mono text-[10px] text-zoru-ink-muted">
                                            {idx + 1}
                                        </span>
                                    </div>
                                    <Input
                                        name={`fields[${idx}][name]`}
                                        placeholder="Field name (e.g. email)"
                                        value={f.name}
                                        onChange={(e) =>
                                            updateField(idx, 'name', e.target.value)
                                        }
                                        required
                                    />
                                    <Input
                                        name={`fields[${idx}][label]`}
                                        placeholder="Label (e.g. Email address)"
                                        value={f.label ?? ''}
                                        onChange={(e) =>
                                            updateField(idx, 'label', e.target.value)
                                        }
                                    />
                                    <EnumFormField
                                        enumName="formFieldType"
                                        initialId={f.type ?? 'text'}
                                        onChange={(v) =>
                                            updateField(idx, 'type', v ?? 'text')
                                        }
                                    />
                                    {/* hidden inputs for the controlled values */}
                                    <input
                                        type="hidden"
                                        name={`fields[${idx}][type]`}
                                        value={f.type ?? 'text'}
                                    />
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Checkbox
                                            id={`fields-${idx}-required`}
                                            checked={!!f.required}
                                            onCheckedChange={(v) =>
                                                updateField(idx, 'required', !!v)
                                            }
                                        />
                                        <Label
                                            htmlFor={`fields-${idx}-required`}
                                            className="cursor-pointer text-[11px] text-zoru-ink-muted"
                                        >
                                            Req
                                        </Label>
                                        <input
                                            type="hidden"
                                            name={`fields[${idx}][required]`}
                                            value={f.required ? 'true' : 'false'}
                                        />
                                    </div>
                                    <Input
                                        name={`fields[${idx}][placeholder]`}
                                        placeholder="Placeholder / options (CSV for select)"
                                        value={
                                            f.type === 'select' || f.type === 'radio'
                                                ? (f.options ?? []).join(', ')
                                                : (f.placeholder ?? '')
                                        }
                                        onChange={(e) => {
                                            if (
                                                f.type === 'select' ||
                                                f.type === 'radio'
                                            ) {
                                                updateField(
                                                    idx,
                                                    'options',
                                                    e.target.value
                                                        .split(',')
                                                        .map((s) => s.trim())
                                                        .filter(Boolean),
                                                );
                                            } else {
                                                updateField(
                                                    idx,
                                                    'placeholder',
                                                    e.target.value,
                                                );
                                            }
                                        }}
                                    />
                                    {/* options field — server-side reads from `fields[i][options]` */}
                                    <input
                                        type="hidden"
                                        name={`fields[${idx}][options]`}
                                        value={(f.options ?? []).join(',')}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeField(idx)}
                                        aria-label="Remove field"
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Settings */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="successMessage">Success message</Label>
                        <Input
                            id="successMessage"
                            name="successMessage"
                            placeholder="Thanks — we'll be in touch."
                            defaultValue={
                                typeof settings.successMessage === 'string'
                                    ? (settings.successMessage as string)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="redirectUrl">Redirect URL</Label>
                        <Input
                            id="redirectUrl"
                            name="redirectUrl"
                            placeholder="https://example.com/thanks"
                            defaultValue={
                                typeof settings.redirectUrl === 'string'
                                    ? (settings.redirectUrl as string)
                                    : ''
                            }
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Checkbox
                        id="captcha"
                        name="captcha"
                        defaultChecked={!!settings.captcha}
                    />
                    <Label htmlFor="captcha" className="cursor-pointer">
                        Require CAPTCHA on submission
                    </Label>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to forms
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
