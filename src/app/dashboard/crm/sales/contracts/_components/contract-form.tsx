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
  Save,
  X } from 'lucide-react';

/**
 * <ContractForm /> — canonical create/edit form for CRM contracts.
 *
 * Binds to `saveContract` (handles both create + update) via
 * `useActionState`. The `attachments[]` list is sourced exclusively
 * from SabFiles via `<SabFilePickerButton>` (no free-text URL paste
 * per the SabFiles project policy) and serialised to a hidden
 * JSON-array input.
 */

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import { saveContract } from '@/app/actions/crm-contracts.actions';
import type {
    CrmContractDoc,
    CrmContractStatus,
} from '@/lib/rust-client/crm-contracts';

const BASE = '/dashboard/crm/sales/contracts';

const TYPE_OPTIONS = [
    { value: 'nda', label: 'NDA' },
    { value: 'msa', label: 'MSA' },
    { value: 'sow', label: 'SOW' },
    { value: 'service', label: 'Service agreement' },
    { value: 'license', label: 'License' },
    { value: 'employment', label: 'Employment' },
    { value: 'other', label: 'Other' },
];

const ESIGN_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'docusign', label: 'DocuSign' },
    { value: 'adobe_sign', label: 'Adobe Sign' },
    { value: 'dropbox_sign', label: 'Dropbox Sign' },
    { value: 'signwell', label: 'SignWell' },
];

const STATUS_OPTIONS: Array<{ value: CrmContractStatus; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'expired', label: 'Expired' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'archived', label: 'Archived' },
];

const CURRENCY_OPTIONS = ['INR', 'USD', 'EUR', 'GBP', 'AED'] as const;

interface AttachmentEntry {
    url: string;
    name: string;
}

interface ContractFormProps {
    initialData?: CrmContractDoc | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function filenameFromUrl(u: string): string {
    if (!u) return '';
    try {
        const path = new URL(u, 'http://x').pathname;
        return decodeURIComponent(path.split('/').pop() ?? '') || u;
    } catch {
        return u;
    }
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create contract'}
        </ZoruButton>
    );
}

export function ContractForm({ initialData }: ContractFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveContract, initialState);

    const [type, setType] = useState<string>(initialData?.type ?? 'nda');
    const [esign, setEsign] = useState<string>(initialData?.esignProvider ?? 'none');
    const [currency, setCurrency] = useState<string>(initialData?.currency ?? 'INR');
    const [status, setStatus] = useState<CrmContractStatus>(
        (initialData?.status as CrmContractStatus) ?? 'draft',
    );
    const [autoRenew, setAutoRenew] = useState<boolean>(!!initialData?.autoRenew);

    const [attachments, setAttachments] = useState<AttachmentEntry[]>(() => {
        const raw = initialData?.attachments;
        if (!Array.isArray(raw) || raw.length === 0) return [];
        return raw
            .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
            .map((url) => ({ url, name: filenameFromUrl(url) }));
    });

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            router.push(id ? `${BASE}/${id}` : BASE);
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router, initialData?._id]);

    const onPickAttachment = (pick: SabFilePick) => {
        setAttachments((prev) => {
            if (prev.some((e) => e.url === pick.url)) return prev;
            return [...prev, { url: pick.url, name: pick.name }];
        });
    };

    const removeAttachment = (url: string) =>
        setAttachments((prev) => prev.filter((e) => e.url !== url));

    const attachmentsJson = JSON.stringify(attachments.map((e) => e.url));

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="contractId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="type" value={type} />
                <input type="hidden" name="esignProvider" value={esign} />
                <input type="hidden" name="currency" value={currency} />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="autoRenew" value={autoRenew ? 'true' : 'false'} />
                <input type="hidden" name="attachments" value={attachmentsJson} />

                {/* Title + Counter-party */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="title">Title *</ZoruLabel>
                        <ZoruInput
                            id="title"
                            name="title"
                            required
                            placeholder="e.g. MSA with Acme Corp"
                            defaultValue={initialData?.title ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="partyName">Counter-party *</ZoruLabel>
                        <ZoruInput
                            id="partyName"
                            name="partyName"
                            required
                            placeholder="Counter-party (org or person)"
                            defaultValue={initialData?.partyName ?? ''}
                        />
                    </div>
                </div>

                {/* Type + Contract # */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel>Type</ZoruLabel>
                        <EnumFormField
                            enumName="contractType"
                            name="__type_picker"
                            initialId={type || null}
                            onChange={(id) => setType(id ?? 'nda')}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="contractNo">Contract #</ZoruLabel>
                        <ZoruInput
                            id="contractNo"
                            name="contractNo"
                            placeholder="Auto-generated if empty"
                            defaultValue={initialData?.contractNo ?? ''}
                        />
                    </div>
                </div>

                {/* Party email + Signatory */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="partyEmail">Party email</ZoruLabel>
                        <ZoruInput
                            id="partyEmail"
                            name="partyEmail"
                            type="email"
                            placeholder="legal@example.com"
                            defaultValue={initialData?.partyEmail ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="signatoryName">Signatory name</ZoruLabel>
                        <ZoruInput
                            id="signatoryName"
                            name="signatoryName"
                            placeholder="Authorised signatory"
                            defaultValue={initialData?.signatoryName ?? ''}
                        />
                    </div>
                </div>

                {/* Scope */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="scope">Scope</ZoruLabel>
                    <ZoruTextarea
                        id="scope"
                        name="scope"
                        rows={3}
                        placeholder="Brief scope or deliverables summary"
                        defaultValue={initialData?.scope ?? ''}
                    />
                </div>

                {/* Currency + Value */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel>Currency</ZoruLabel>
                        <EntityFormField
                            entity="currency"
                            name="__currency_picker"
                            initialId={currency}
                            onChange={(id) => setCurrency(id ?? 'INR')}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="value">Contract value</ZoruLabel>
                        <ZoruInput
                            id="value"
                            name="value"
                            type="number"
                            min={0}
                            step="any"
                            placeholder="0.00"
                            defaultValue={initialData?.value ?? ''}
                        />
                    </div>
                </div>

                {/* Effective + Expiry dates */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="effectiveDate">Effective date</ZoruLabel>
                        <ZoruInput
                            id="effectiveDate"
                            name="effectiveDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.effectiveDate)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="expiryDate">Expiry date</ZoruLabel>
                        <ZoruInput
                            id="expiryDate"
                            name="expiryDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.expiryDate)}
                        />
                    </div>
                </div>

                {/* Auto-renew + Notice + e-sign provider */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex items-center gap-2 self-end pb-1.5">
                        <ZoruCheckbox
                            id="autoRenew"
                            checked={autoRenew}
                            onCheckedChange={(v) => setAutoRenew(!!v)}
                        />
                        <ZoruLabel htmlFor="autoRenew" className="cursor-pointer">
                            Auto-renew
                        </ZoruLabel>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="renewalNoticeDays">Renewal notice (days)</ZoruLabel>
                        <ZoruInput
                            id="renewalNoticeDays"
                            name="renewalNoticeDays"
                            type="number"
                            min={0}
                            step={1}
                            placeholder="30"
                            defaultValue={initialData?.renewalNoticeDays ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>E-sign provider</ZoruLabel>
                        <EnumFormField
                            enumName="esignProvider"
                            name="__esign_picker"
                            initialId={esign || null}
                            onChange={(id) => setEsign(id ?? 'none')}
                        />
                    </div>
                </div>

                {/* Attachments — SabFiles only */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <ZoruLabel>Attachments (from SabFiles)</ZoruLabel>
                        <SabFilePickerButton
                            accept="all"
                            onPick={onPickAttachment}
                            title="Pick attachments from SabFiles"
                            variant="ghost"
                        >
                            <FileUp className="mr-1.5 h-4 w-4" />
                            Add attachment
                        </SabFilePickerButton>
                    </div>
                    {attachments.length === 0 ? (
                        <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-4 text-center text-[12.5px] text-zoru-ink-muted">
                            No attachments. Use &ldquo;Add attachment&rdquo; to pick files
                            from SabFiles.
                        </div>
                    ) : (
                        <ul className="flex flex-col gap-1.5">
                            {attachments.map((e) => (
                                <li
                                    key={e.url}
                                    className="flex items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 px-3 py-2"
                                >
                                    <a
                                        href={e.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="max-w-[80%] truncate text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
                                    >
                                        {e.name || e.url}
                                    </a>
                                    <ZoruButton
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeAttachment(e.url)}
                                        aria-label="Remove attachment"
                                    >
                                        <X className="h-4 w-4" />
                                    </ZoruButton>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Notes + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                        <ZoruTextarea
                            id="notes"
                            name="notes"
                            rows={3}
                            placeholder="Internal notes (not visible to the party)"
                            defaultValue={initialData?.notes ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>Status</ZoruLabel>
                        <EnumFormField
                            enumName="contractStatusV2"
                            name="__status_picker"
                            initialId={status || null}
                            onChange={(id) => setStatus((id ?? 'draft') as CrmContractStatus)}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to contracts
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
