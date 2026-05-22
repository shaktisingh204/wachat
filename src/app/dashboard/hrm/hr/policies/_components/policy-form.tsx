'use client';

import { Button, Card, Checkbox, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  FileUp,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * <PolicyForm /> — create + edit form for HR policies.
 *
 * Binds to the `savePolicy` server action via `useActionState`. The
 * `document_url` slot uses `<SabFilePickerButton>` because the SabFiles
 * project policy forbids any free-text URL paste for file inputs.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import { savePolicy } from '@/app/actions/crm-policies.actions';
import type {
    CrmPolicyCategory,
    CrmPolicyDoc,
    CrmPolicyStatus,
} from '@/lib/rust-client/crm-policies';

const BASE = '/dashboard/hrm/hr/policies';

/**
 * Convert an ISO date string (or BSON-shaped datetime) into the
 * `YYYY-MM-DD` value expected by `<input type="date">`.
 */
function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

interface PolicyFormProps {
    initialData?: CrmPolicyDoc | null;
}

type SaveState = { message?: string; error?: string; id?: string };

const initialState: SaveState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create policy'}
        </Button>
    );
}

export function PolicyForm({ initialData }: PolicyFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(savePolicy, initialState);

    // Local state for the document_url SabFile pick so we can render the
    // chosen filename inline. The hidden input ensures the value still
    // flows through the form action.
    const [documentUrl, setDocumentUrl] = useState<string>(
        initialData?.documentUrl ?? '',
    );
    const [documentName, setDocumentName] = useState<string>(() => {
        const u = initialData?.documentUrl;
        if (!u) return '';
        try {
            const path = new URL(u, 'http://x').pathname;
            return decodeURIComponent(path.split('/').pop() ?? '') || u;
        } catch {
            return u;
        }
    });

    // Drive the controlled `<Select>`s. Form submission still reads
    // the bound `<select>` hidden under the hood (ZoruSelect renders a
    // native element internally), but mirroring state keeps the labels
    // in sync after the user changes them.
    const [category, setCategory] = useState<string>(
        initialData?.category ?? 'hr',
    );
    const [status, setStatus] = useState<CrmPolicyStatus>(
        (initialData?.status as CrmPolicyStatus) ?? 'draft',
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

    const onPickDocument = (pick: SabFilePick) => {
        setDocumentUrl(pick.url);
        setDocumentName(pick.name);
    };

    const clearDocument = () => {
        setDocumentUrl('');
        setDocumentName('');
    };

    const tagsInitial = Array.isArray(initialData?.tags)
        ? (initialData?.tags ?? []).join(', ')
        : '';

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="policyId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="documentUrl" value={documentUrl} />
                <input type="hidden" name="category" value={category} />
                <input type="hidden" name="status" value={status} />

                {/* Row 1: Name */}
                <div className="space-y-1.5">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                        id="name"
                        name="name"
                        required
                        placeholder="e.g. Employee Code of Conduct"
                        defaultValue={initialData?.name ?? ''}
                    />
                </div>

                {/* Row 2: Version + Category */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="version">Version</Label>
                        <Input
                            id="version"
                            name="version"
                            placeholder="1.0"
                            defaultValue={initialData?.version ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Category</Label>
                        <EnumFormField
                            name="category-picker"
                            enumName="policyDocCategory"
                            initialId={category}
                            onChange={(id) =>
                                setCategory((id as CrmPolicyCategory) ?? 'other')
                            }
                            allowInlineCreate={false}
                            placeholder="Pick a category…"
                        />
                    </div>
                </div>

                {/* Row 3: Summary */}
                <div className="space-y-1.5">
                    <Label htmlFor="summary">Summary</Label>
                    <Textarea
                        id="summary"
                        name="summary"
                        rows={2}
                        placeholder="One-paragraph summary shown above the policy body."
                        defaultValue={initialData?.summary ?? ''}
                    />
                </div>

                {/* Row 4: Content (markdown) */}
                <div className="space-y-1.5">
                    <Label htmlFor="contentMarkdown">
                        Content (markdown)
                    </Label>
                    <Textarea
                        id="contentMarkdown"
                        name="contentMarkdown"
                        rows={10}
                        placeholder="# Policy body…&#10;&#10;Markdown is supported."
                        defaultValue={initialData?.content ?? ''}
                    />
                </div>

                {/* Row 5: Document (SabFile) */}
                <div className="space-y-1.5">
                    <Label>Attached document</Label>
                    <div className="flex flex-wrap items-center gap-2">
                        <SabFilePickerButton
                            accept="document"
                            onPick={onPickDocument}
                            title="Pick a policy document"
                        >
                            <FileUp className="mr-1.5 h-4 w-4" />
                            {documentUrl ? 'Replace document' : 'Choose from SabFiles'}
                        </SabFilePickerButton>
                        {documentUrl ? (
                            <>
                                <a
                                    href={documentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="max-w-[260px] truncate text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
                                >
                                    {documentName || documentUrl}
                                </a>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearDocument}
                                >
                                    Remove
                                </Button>
                            </>
                        ) : (
                            <span className="text-[12px] text-zoru-ink-muted">
                                No document attached.
                            </span>
                        )}
                    </div>
                </div>

                {/* Row 6: Dates — Effective / Review / Expiry */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="effectiveDate">Effective date</Label>
                        <Input
                            id="effectiveDate"
                            name="effectiveDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.effectiveDate)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="reviewDate">Review date</Label>
                        <Input
                            id="reviewDate"
                            name="reviewDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.reviewDate)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="expiryDate">Expiry date</Label>
                        <Input
                            id="expiryDate"
                            name="expiryDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.expiryDate)}
                        />
                    </div>
                </div>

                {/* Row 7: Owner + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Owner</Label>
                        <EntityFormField
                            entity="employee"
                            name="ownerId"
                            initialId={initialData?.ownerId ?? null}
                            allowCreate
                            placeholder="Policy owner"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            name="status-picker"
                            enumName="policyDocStatus"
                            initialId={status}
                            onChange={(id) =>
                                setStatus((id as CrmPolicyStatus) ?? 'draft')
                            }
                            allowInlineCreate={false}
                            placeholder="Status"
                        />
                    </div>
                </div>

                {/* Row 8: Tags + Acknowledgement */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="tags">Tags</Label>
                        <Input
                            id="tags"
                            name="tags"
                            placeholder="comma, separated, tags"
                            defaultValue={tagsInitial}
                        />
                    </div>
                    <div className="flex items-center gap-2 self-end pb-1.5">
                        <Checkbox
                            id="requireAcknowledgement"
                            name="requireAcknowledgement"
                            defaultChecked={!!initialData?.acknowledgementRequired}
                        />
                        <Label
                            htmlFor="requireAcknowledgement"
                            className="cursor-pointer"
                        >
                            Require employee acknowledgement
                        </Label>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to policies
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
