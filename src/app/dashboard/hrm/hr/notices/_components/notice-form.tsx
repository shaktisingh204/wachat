'use client';

import {
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
  File as FileIcon,
  LoaderCircle,
  Save,
  Upload,
  X,
  } from 'lucide-react';

/**
 * <NoticeForm /> — shared create/edit form for HR Notices.
 *
 * Wraps `saveNotice` from `crm-notices.actions.ts` with `useActionState` +
 * `useFormStatus`. When `initialData` is supplied the form acts as an edit
 * form (a hidden `noticeId` input is rendered and the action takes the
 * PATCH branch).
 *
 * SabFiles policy: attachments come ONLY from the SabFiles library /
 * upload — there is NO free-text URL paste. Each picked attachment is
 * rendered as a row with a hidden `<input name="attachments">` so the
 * server action's `formData.getAll('attachments')` returns the array.
 */

import * as React from 'react';

import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { saveNotice } from '@/app/actions/crm-notices.actions';
import type { CrmNoticeDoc } from '@/lib/rust-client/crm-notices';

/* ─── Local types ────────────────────────────────────────────────────── */

interface AttachmentItem {
    /** Stable client-only id for React keys. */
    key: string;
    /** SabFiles URL — the value POSTed back to the server. */
    url: string;
    /** Display name shown in the row. */
    name: string;
    /** MIME, when known — drives the icon. */
    mime?: string;
}

const NOTICE_CATEGORIES = [
    { value: 'general', label: 'General' },
    { value: 'safety', label: 'Safety' },
    { value: 'compliance', label: 'Compliance' },
    { value: 'closure', label: 'Closure' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'emergency', label: 'Emergency' },
] as const;

// §1E.sweep: NOTICE_SEVERITIES removed — severity field already uses <EnumFormField enumName="announcementSeverity">.
// §1E.sweep: NOTICE_CATEGORIES/NOTICE_AUDIENCES/NOTICE_STATUSES kept — slugs differ from any CRM_ENUMS entry; resolve Rust DTO first.

const NOTICE_AUDIENCES = [
    { value: 'all', label: 'All employees' },
    { value: 'department', label: 'Department' },
    { value: 'team', label: 'Team' },
    { value: 'role', label: 'Role' },
    { value: 'individual', label: 'Individual(s)' },
] as const;

const NOTICE_STATUSES = [
    { value: 'draft', label: 'Draft' },
    { value: 'issued', label: 'Issued' },
    { value: 'acknowledged', label: 'Acknowledged' },
    { value: 'superseded', label: 'Superseded' },
] as const;

const initialState: { message?: string; error?: string; id?: string } = {};

/* ─── Submit button ──────────────────────────────────────────────────── */

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create notice'}
        </Button>
    );
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

/** Convert a YYYY-MM-DDTHH:mm:ssZ stamp (or any Date-ish value) to a
 *  `YYYY-MM-DD` string for `<input type="date">`. */
function toDateInput(v?: string | null): string {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function nameFromUrl(url: string): string {
    if (!url) return '';
    try {
        const path = new URL(url, 'http://x').pathname;
        const last = path.split('/').filter(Boolean).pop() ?? '';
        const decoded = decodeURIComponent(last);
        return decoded.replace(/^[0-9a-f]{16,}-/i, '') || decoded || url;
    } catch {
        return url;
    }
}

/* ─── Component ──────────────────────────────────────────────────────── */

export interface NoticeFormProps {
    initialData?: CrmNoticeDoc | null;
}

export function NoticeForm({ initialData }: NoticeFormProps) {
    const isEditing = !!initialData?._id;
    const router = useRouter();
    const { toast } = useZoruToast();

    const [state, formAction] = useActionState(saveNotice, initialState);

    // Hydrate attachments from initialData. Each picker pick (or initial
    // entry) gets a stable client-only `key` so React can diff the list.
    const seededAttachments = React.useMemo<AttachmentItem[]>(() => {
        if (!initialData?.attachments?.length) return [];
        return initialData.attachments.map((url, i) => ({
            key: `init-${i}-${url}`,
            url,
            name: nameFromUrl(url),
        }));
    }, [initialData]);
    const [attachments, setAttachments] =
        React.useState<AttachmentItem[]>(seededAttachments);

    React.useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            if (state.id) {
                router.push(`/dashboard/hrm/hr/notices/${state.id}`);
            } else {
                router.push('/dashboard/hrm/hr/notices');
            }
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router]);

    const onAttachmentPicked = React.useCallback((pick: SabFilePick) => {
        setAttachments((curr) => {
            // Skip duplicates (same SabFiles id already added).
            if (curr.some((a) => a.key === `pick-${pick.id}`)) return curr;
            return [
                ...curr,
                {
                    key: `pick-${pick.id}`,
                    url: pick.url,
                    name: pick.name,
                    mime: pick.mime,
                },
            ];
        });
    }, []);

    const removeAttachment = React.useCallback((key: string) => {
        setAttachments((curr) => curr.filter((a) => a.key !== key));
    }, []);

    return (
        <form action={formAction} className="flex flex-col gap-6">
            {isEditing ? (
                <input
                    type="hidden"
                    name="noticeId"
                    value={String(initialData!._id)}
                />
            ) : null}

            <Card className="p-6">
                <div className="mb-4 text-[14px] font-medium text-[var(--st-text)]">
                    Notice details
                </div>

                <div className="flex flex-col gap-4">
                    {/* Row: number + reference */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="noticeNumber">
                                Notice Number
                            </Label>
                            <Input
                                id="noticeNumber"
                                name="noticeNumber"
                                placeholder="Auto-generated when blank"
                                defaultValue={initialData?.noticeNumber ?? ''}
                            />
                            <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                                Leave blank to auto-generate (e.g. NTC-2026-0001).
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="referenceNumber">
                                Reference Number
                            </Label>
                            <Input
                                id="referenceNumber"
                                name="referenceNumber"
                                placeholder="Optional external reference"
                                defaultValue={initialData?.referenceNumber ?? ''}
                            />
                        </div>
                    </div>

                    {/* Title */}
                    <div className="space-y-1.5">
                        <Label htmlFor="title">Title *</Label>
                        <Input
                            id="title"
                            name="title"
                            placeholder="A short headline for the notice"
                            required
                            defaultValue={initialData?.title ?? ''}
                        />
                    </div>

                    {/* Body */}
                    <div className="space-y-1.5">
                        <Label htmlFor="body">Body *</Label>
                        <Textarea
                            id="body"
                            name="body"
                            placeholder="Full text of the notice. Markdown is supported."
                            rows={8}
                            required
                            defaultValue={initialData?.body ?? ''}
                        />
                    </div>

                    {/* Category / Severity / Audience */}
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="category">Category</Label>
                            <Select
                                name="category"
                                defaultValue={
                                    (initialData?.category as string) ?? 'general'
                                }
                            >
                                <ZoruSelectTrigger id="category">
                                    <ZoruSelectValue placeholder="Category" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {NOTICE_CATEGORIES.map((c) => (
                                        <ZoruSelectItem key={c.value} value={c.value}>
                                            {c.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Severity</Label>
                            <EnumFormField
                                enumName="announcementSeverity"
                                name="severity"
                                initialId={
                                    (initialData?.severity as string) ?? 'info'
                                }
                                placeholder="Severity"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="issuedTo">Issued To</Label>
                            <Select
                                name="issuedTo"
                                defaultValue={
                                    (initialData?.issuedTo as string) ?? 'all'
                                }
                            >
                                <ZoruSelectTrigger id="issuedTo">
                                    <ZoruSelectValue placeholder="Audience" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {NOTICE_AUDIENCES.map((c) => (
                                        <ZoruSelectItem key={c.value} value={c.value}>
                                            {c.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Effective dates */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="effectiveFrom">
                                Effective From
                            </Label>
                            <Input
                                id="effectiveFrom"
                                name="effectiveFrom"
                                type="date"
                                defaultValue={toDateInput(initialData?.effectiveFrom)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="effectiveUntil">
                                Effective Until
                            </Label>
                            <Input
                                id="effectiveUntil"
                                name="effectiveUntil"
                                type="date"
                                defaultValue={toDateInput(initialData?.effectiveUntil)}
                            />
                        </div>
                    </div>

                    {/* Acknowledgement + Status */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex items-center gap-2 pt-6">
                            <Checkbox
                                id="requireAcknowledgement"
                                name="requireAcknowledgement"
                                defaultChecked={
                                    !!initialData?.requireAcknowledgement
                                }
                            />
                            <Label
                                htmlFor="requireAcknowledgement"
                                className="cursor-pointer text-[13px] font-normal"
                            >
                                Require recipients to acknowledge this notice
                            </Label>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="status">Status</Label>
                            <Select
                                name="status"
                                defaultValue={
                                    (initialData?.status as string) ?? 'draft'
                                }
                            >
                                <ZoruSelectTrigger id="status">
                                    <ZoruSelectValue placeholder="Status" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {NOTICE_STATUSES.map((c) => (
                                        <ZoruSelectItem key={c.value} value={c.value}>
                                            {c.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                        <Label htmlFor="notes">Internal notes</Label>
                        <Textarea
                            id="notes"
                            name="notes"
                            placeholder="Notes visible to HR only (not shown to recipients)."
                            rows={3}
                            defaultValue={initialData?.notes ?? ''}
                        />
                    </div>
                </div>
            </Card>

            {/* Attachments — SabFiles only, no URL paste */}
            <Card className="p-6">
                <div className="mb-1 flex items-baseline justify-between">
                    <div className="text-[14px] font-medium text-[var(--st-text)]">
                        Attachments
                    </div>
                    <span className="text-[11.5px] text-[var(--st-text-secondary)]">
                        {attachments.length} file
                        {attachments.length === 1 ? '' : 's'}
                    </span>
                </div>
                <p className="mb-4 text-[12px] text-[var(--st-text-secondary)]">
                    Pick from your SabFiles library or upload a new file. External
                    URLs are not supported.
                </p>

                {attachments.length === 0 ? (
                    <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-6 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                        No attachments yet.
                    </div>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {attachments.map((a) => (
                            <li
                                key={a.key}
                                className="flex items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2"
                            >
                                {a.mime?.startsWith('image/') ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={a.url}
                                        alt=""
                                        className="h-8 w-8 shrink-0 rounded object-cover"
                                    />
                                ) : (
                                    <FileIcon className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)]" />
                                )}
                                <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--st-text)]">
                                    {a.name}
                                </span>
                                {/* The actual payload — FormData.getAll('attachments') reads these. */}
                                <input
                                    type="hidden"
                                    name="attachments"
                                    value={a.url}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Remove ${a.name}`}
                                    onClick={() => removeAttachment(a.key)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="mt-3">
                    <SabFilePickerButton
                        onPick={onAttachmentPicked}
                        variant="outline"
                    >
                        <Upload className="mr-1.5 h-4 w-4" />
                        Add from SabFiles
                    </SabFilePickerButton>
                </div>
            </Card>

            {/* Form actions */}
            <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" asChild>
                    <Link
                        href={
                            isEditing && initialData?._id
                                ? `/dashboard/hrm/hr/notices/${initialData._id}`
                                : '/dashboard/hrm/hr/notices'
                        }
                    >
                        <ArrowLeft className="mr-1.5 h-4 w-4" />
                        Cancel
                    </Link>
                </Button>
                <SubmitButton isEditing={isEditing} />
            </div>
        </form>
    );
}
