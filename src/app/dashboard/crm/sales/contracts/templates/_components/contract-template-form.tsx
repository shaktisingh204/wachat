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
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';

import { EnumFormField } from '@/components/crm/enum-form-field';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * <ContractTemplateForm /> — create + edit form for CRM Contract Templates.
 *
 * Posts to `saveContractTemplate` via `useActionState`. The body is a plain
 * `<ZoruTextarea>` (markdown, no WYSIWYG) so the template author can paste
 * `{{variable}}` placeholders directly.
 */

import {
    saveContractTemplate,
    type CrmContractTemplateDoc,
    type CrmContractTemplateStatus,
    type CrmContractTemplateType,
} from '@/app/actions/crm-contract-templates.actions';

const BASE = '/dashboard/crm/sales/contracts/templates';

const TYPE_OPTIONS: Array<{
    value: CrmContractTemplateType;
    label: string;
}> = [
    { value: 'service', label: 'Service' },
    { value: 'sales', label: 'Sales' },
    { value: 'nda', label: 'NDA' },
    { value: 'msa', label: 'MSA' },
    { value: 'sow', label: 'SOW' },
    { value: 'employment', label: 'Employment' },
    { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS: Array<{
    value: CrmContractTemplateStatus;
    label: string;
}> = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
];

const initialState: { message?: string; error?: string; id?: string } = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create template'}
        </ZoruButton>
    );
}

export interface ContractTemplateFormProps {
    initialData?: CrmContractTemplateDoc | null;
}

export function ContractTemplateForm({
    initialData,
}: ContractTemplateFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(
        saveContractTemplate,
        initialState,
    );

    const [type, setType] = useState<CrmContractTemplateType>(
        (initialData?.type as CrmContractTemplateType) ?? 'service',
    );
    const [status, setStatus] = useState<CrmContractTemplateStatus>(
        (initialData?.status as CrmContractTemplateStatus) ?? 'draft',
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            if (id) {
                router.push(`${BASE}/${id}`);
            } else {
                router.push(BASE);
            }
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    const variablesInitial = (initialData?.variables ?? []).join(', ');

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="templateId"
                        value={initialData!._id}
                    />
                ) : null}
                <input type="hidden" name="type" value={type} />
                <input type="hidden" name="status" value={status} />

                {/* Row 1: Name + Type */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="name">
                            Name <span className="text-red-500">*</span>
                        </ZoruLabel>
                        <ZoruInput
                            id="name"
                            name="name"
                            required
                            placeholder="e.g. Standard MSA Template"
                            defaultValue={initialData?.name ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>Type</ZoruLabel>
                        <EnumFormField
                            enumName="contractTemplateType"
                            name="__type_picker"
                            initialId={type}
                            placeholder="Pick a type…"
                            onChange={(v) => setType((v ?? 'service') as CrmContractTemplateType)}
                        />
                    </div>
                </div>

                {/* Row 2: Body (markdown textarea, not WYSIWYG) */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="body">Body (markdown)</ZoruLabel>
                    <ZoruTextarea
                        id="body"
                        name="body"
                        rows={14}
                        placeholder="# Contract title&#10;&#10;Between {{party_a}} and {{party_b}}…&#10;&#10;Markdown is supported. Use {{variable}} placeholders."
                        defaultValue={initialData?.body ?? ''}
                        className="font-mono text-[12.5px]"
                    />
                </div>

                {/* Row 3: Default term months + Default auto-renew */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="defaultTermMonths">
                            Default term (months)
                        </ZoruLabel>
                        <ZoruInput
                            id="defaultTermMonths"
                            name="defaultTermMonths"
                            type="number"
                            min="0"
                            step="1"
                            placeholder="e.g. 12"
                            defaultValue={initialData?.defaultTermMonths ?? ''}
                        />
                    </div>
                    <div className="flex items-center gap-2 self-end pb-1.5">
                        <ZoruCheckbox
                            id="defaultAutoRenew"
                            name="defaultAutoRenew"
                            defaultChecked={!!initialData?.defaultAutoRenew}
                        />
                        <ZoruLabel
                            htmlFor="defaultAutoRenew"
                            className="cursor-pointer"
                        >
                            Default auto-renew on
                        </ZoruLabel>
                    </div>
                </div>

                {/* Row 4: Variables */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="variables">
                        Variables (comma-separated)
                    </ZoruLabel>
                    <ZoruInput
                        id="variables"
                        name="variables"
                        placeholder="e.g. party_a, party_b, start_date, fee"
                        defaultValue={variablesInitial}
                    />
                    <p className="text-[11.5px] text-zoru-ink-muted">
                        These names are offered as placeholders in the contract
                        editor.
                    </p>
                </div>

                {/* Row 5: Status + Active */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel>Status</ZoruLabel>
                        <EnumFormField
                            enumName="contractTemplateStatus"
                            name="__status_picker"
                            initialId={status}
                            onChange={(v) => setStatus((v ?? 'draft') as CrmContractTemplateStatus)}
                        />
                    </div>
                    <div className="flex items-center gap-2 self-end pb-1.5">
                        <ZoruCheckbox
                            id="isActive"
                            name="isActive"
                            defaultChecked={initialData?.isActive !== false}
                        />
                        <ZoruLabel
                            htmlFor="isActive"
                            className="cursor-pointer"
                        >
                            Available for selection
                        </ZoruLabel>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to templates
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
