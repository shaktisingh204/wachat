'use client';

import { Button, Card, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useState,
  useId } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import {
    ArrowLeft,
  FileUp,
  GripVertical,
  LoaderCircle,
  Paperclip,
  Plus,
  Save,
  Trash2,
  X,
  } from 'lucide-react';

/**
 * <ProposalForm /> — create + edit form for CRM Sales Proposals.
 *
 * Binds to the `saveProposal` server action via `useActionState`. Key
 * pieces:
 *   - section repeater (heading + body), not raw JSON
 *   - attachments multi-pick via `<SabFilePickerButton>` (SabFiles policy)
 *   - status select with the full status set
 */

import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import {
    saveProposal,
    type CrmProposalSection,
    type CrmProposalAttachment,
    type CrmProposalStatus,
} from '@/app/actions/crm-proposals.actions';
import { EnumFormField } from '@/components/crm/enum-form-field';

const BASE = '/dashboard/crm/sales/proposals';

const STATUS_OPTIONS: Array<{ value: CrmProposalStatus; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'expired', label: 'Expired' },
    { value: 'archived', label: 'Archived' },
];

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
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
            {isEditing ? 'Save changes' : 'Create proposal'}
        </Button>
    );
}

export interface ProposalFormProps {
    initialData?: Record<string, any> | null;
}

export function ProposalForm({ initialData }: ProposalFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const reactId = useId();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveProposal, initialState);

    const [status, setStatus] = useState<CrmProposalStatus>(
        (initialData?.status as CrmProposalStatus) ?? 'draft',
    );
    const [currency, setCurrency] = useState<string>(
        initialData?.currency ?? 'INR',
    );

    const [sections, setSections] = useState<CrmProposalSection[]>(() => {
        const raw = initialData?.sections;
        if (Array.isArray(raw) && raw.length > 0) {
            return raw.map((row: any) => ({
                heading: typeof row?.heading === 'string' ? row.heading : '',
                body: typeof row?.body === 'string' ? row.body : '',
            }));
        }
        return [{ heading: '', body: '' }];
    });

    const [attachments, setAttachments] = useState<CrmProposalAttachment[]>(() => {
        const raw = initialData?.attachments;
        if (Array.isArray(raw)) {
            return raw
                .filter((row: any) => typeof row?.url === 'string')
                .map((row: any) => ({
                    url: String(row.url),
                    name: typeof row?.name === 'string' ? row.name : row.url,
                }));
        }
        return [];
    });

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? (initialData?._id as string | undefined);
            router.push(id ? `${BASE}/${id}` : BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    const updateSection = (
        idx: number,
        patch: Partial<CrmProposalSection>,
    ) => {
        setSections((prev) =>
            prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
        );
    };

    const addSection = () => {
        setSections((prev) => [...prev, { heading: '', body: '' }]);
    };

    const removeSection = (idx: number) => {
        setSections((prev) =>
            prev.length === 1 ? prev : prev.filter((_, i) => i !== idx),
        );
    };

    const onPickAttachment = (pick: SabFilePick) => {
        setAttachments((prev) => {
            if (prev.some((a) => a.url === pick.url)) return prev;
            return [...prev, { url: pick.url, name: pick.name || pick.url }];
        });
    };

    const removeAttachment = (idx: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== idx));
    };

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="proposalId"
                        value={initialData!._id as string}
                    />
                ) : null}
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="currency" value={currency} />
                <input
                    type="hidden"
                    name="sections"
                    value={JSON.stringify(sections)}
                />
                <input
                    type="hidden"
                    name="attachments"
                    value={JSON.stringify(attachments)}
                />

                {/* Row 1: Title */}
                <div className="space-y-1.5">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                        id="title"
                        name="title"
                        required
                        placeholder="e.g. Q3 services proposal for Acme Corp"
                        defaultValue={initialData?.title ?? ''}
                    />
                </div>

                {/* Row 2: Account + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="accountId">Account / client</Label>
                        <Input
                            id="accountId"
                            name="accountId"
                            placeholder="Account id or name"
                            defaultValue={initialData?.accountId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            enumName="proposalStatus"
                            name="__status_picker"
                            initialId={status}
                            onChange={(v) => setStatus((v ?? 'draft') as CrmProposalStatus)}
                        />
                    </div>
                </div>

                {/* Row 3: Amount + Currency + Valid until */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="totalAmount">Total amount</Label>
                        <Input
                            id="totalAmount"
                            name="totalAmount"
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="0.00"
                            defaultValue={
                                initialData?.totalAmount != null
                                    ? String(initialData.totalAmount)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor={`${reactId}-currency`}>Currency</Label>
                        <Select value={currency} onValueChange={setCurrency}>
                            <ZoruSelectTrigger id={`${reactId}-currency`}>
                                <ZoruSelectValue placeholder="Currency" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {['INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD'].map((c) => (
                                    <ZoruSelectItem key={c} value={c}>
                                        {c}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="validUntil">Valid until</Label>
                        <Input
                            id="validUntil"
                            name="validUntil"
                            type="date"
                            defaultValue={toDateInput(initialData?.validUntil)}
                        />
                    </div>
                </div>

                {/* Sections repeater */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label>Proposal sections</Label>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={addSection}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add section
                        </Button>
                    </div>
                    <div className="flex flex-col gap-3">
                        {sections.map((s, idx) => (
                            <div
                                key={idx}
                                className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3"
                            >
                                <div className="mb-2 flex items-center gap-2">
                                    <GripVertical className="h-4 w-4 text-[var(--st-text-secondary)]" />
                                    <Input
                                        placeholder={`Section ${idx + 1} heading`}
                                        value={s.heading}
                                        onChange={(e) =>
                                            updateSection(idx, {
                                                heading: e.target.value,
                                            })
                                        }
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeSection(idx)}
                                        disabled={sections.length === 1}
                                        title="Remove section"
                                    >
                                        <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                    </Button>
                                </div>
                                <Textarea
                                    rows={4}
                                    placeholder="Section body — markdown supported."
                                    value={s.body}
                                    onChange={(e) =>
                                        updateSection(idx, { body: e.target.value })
                                    }
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Attachments — SabFiles only */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Attachments</Label>
                        <SabFilePickerButton
                            accept="any"
                            onPick={onPickAttachment}
                            title="Attach a file from SabFiles"
                            variant="ghost"
                            size="sm"
                        >
                            <FileUp className="mr-1.5 h-3.5 w-3.5" />
                            Add from SabFiles
                        </SabFilePickerButton>
                    </div>
                    {attachments.length === 0 ? (
                        <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-4 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                            No attachments yet. Use &ldquo;Add from SabFiles&rdquo;.
                        </div>
                    ) : (
                        <ul className="flex flex-col gap-1.5">
                            {attachments.map((a, idx) => (
                                <li
                                    key={`${a.url}-${idx}`}
                                    className="flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2"
                                >
                                    <Paperclip className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                                    <a
                                        href={a.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--st-text)] hover:underline"
                                    >
                                        {a.name || a.url}
                                    </a>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeAttachment(idx)}
                                        title="Remove attachment"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to proposals
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
