'use client';

import { Button, Card, Checkbox, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
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
 * `<Textarea>` (markdown, no WYSIWYG) so the template author can paste
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
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create template'}
        </Button>
    );
}

export interface ContractTemplateFormProps {
    initialData?: CrmContractTemplateDoc | null;
}

export function ContractTemplateForm({
    initialData,
}: ContractTemplateFormProps) {
    const router = useRouter();
    const { toast } = useToast();
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
        <Card className="p-6">
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
                        <Label htmlFor="name">
                            Name <span className="text-[var(--st-text)]">*</span>
                        </Label>
                        <Input
                            id="name"
                            name="name"
                            required
                            placeholder="e.g. Standard MSA Template"
                            defaultValue={initialData?.name ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Type</Label>
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
                    <Label htmlFor="body">Body (markdown)</Label>
                    <Textarea
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
                        <Label htmlFor="defaultTermMonths">
                            Default term (months)
                        </Label>
                        <Input
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
                        <Checkbox
                            id="defaultAutoRenew"
                            name="defaultAutoRenew"
                            defaultChecked={!!initialData?.defaultAutoRenew}
                        />
                        <Label
                            htmlFor="defaultAutoRenew"
                            className="cursor-pointer"
                        >
                            Default auto-renew on
                        </Label>
                    </div>
                </div>

                {/* Row 4: Variables */}
                <div className="space-y-1.5">
                    <Label htmlFor="variables">
                        Variables (comma-separated)
                    </Label>
                    <Input
                        id="variables"
                        name="variables"
                        placeholder="e.g. party_a, party_b, start_date, fee"
                        defaultValue={variablesInitial}
                    />
                    <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                        These names are offered as placeholders in the contract
                        editor.
                    </p>
                </div>

                {/* Row 5: Status + Active */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            enumName="contractTemplateStatus"
                            name="__status_picker"
                            initialId={status}
                            onChange={(v) => setStatus((v ?? 'draft') as CrmContractTemplateStatus)}
                        />
                    </div>
                    <div className="flex items-center gap-2 self-end pb-1.5">
                        <Checkbox
                            id="isActive"
                            name="isActive"
                            defaultChecked={initialData?.isActive !== false}
                        />
                        <Label
                            htmlFor="isActive"
                            className="cursor-pointer"
                        >
                            Available for selection
                        </Label>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to templates
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
