'use client';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
  Switch,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityFormField } from '@/components/crm/entity-form-field';
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  LoaderCircle,
  Paperclip,
  Plus,
  Save,
  Upload,
  X,
} from 'lucide-react';
import Link from 'next/link';

/**
 * Announcement form (§1B W7, deepened §3.3.2) — shared by /new and /[id]/edit.
 *
 * Deepening additions on top of the original sectioned form:
 *  - Targeting picker (departments) with chip list — augments the legacy
 *    free-text `audienceIds` comma-separated input by writing the same
 *    field name, so the existing server action is unchanged.
 *  - Multi-file attachment list via SabFilePickerButton (in addition to
 *    the banner image) — JSON-encoded into a hidden `attachments` field.
 *  - Reorganised into Card sections (Content · Schedule · Targeting
 *    · Behaviour · Attachments).
 *  - Falls back to Textarea for the body — there is no shared rich
 *    text editor in the repo today (see report; only Meta-Flow's
 *    in-canvas RichText component exists, which is not reusable here).
 */

import * as React from 'react';

import { SabFilePickerButton } from '@/components/sabfiles';

import { saveAnnouncement } from '@/app/actions/crm-announcements.actions';
import type { CrmAnnouncementDoc } from '@/lib/rust-client/crm-announcements';

const BASE = '/dashboard/sabconnect/announcements';

interface DeptChip {
    id: string;
    name: string;
}

interface AttachmentRow {
    id: string;
    url: string;
    name: string;
    mime?: string;
    size?: number;
}

export interface AnnouncementFormProps {
    mode: 'new' | 'edit';
    announcement?: CrmAnnouncementDoc | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const INITIAL_STATE: SaveState = { message: '', error: '' };

function parseInitialDepartments(
    announcement?: CrmAnnouncementDoc | null,
): DeptChip[] {
    const ids = announcement?.audienceIds ?? [];
    return ids.map((id) => ({ id, name: '' }));
}

export function AnnouncementForm({
    mode,
    announcement,
}: AnnouncementFormProps): React.JSX.Element {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [state, formAction] = useActionState(
        saveAnnouncement,
        INITIAL_STATE as SaveState,
    );

    const [bannerUrl, setBannerUrl] = useState<string>(
        announcement?.bannerUrl ?? '',
    );
    const [bannerName, setBannerName] = useState<string>('');
    const [audienceMode, setAudienceMode] = useState<string>(
        announcement?.audience ?? 'all',
    );
    const [departments, setDepartments] = useState<DeptChip[]>(
        parseInitialDepartments(announcement),
    );
    const [pendingDeptId, setPendingDeptId] = useState<string>('');
    const [pendingDeptName, setPendingDeptName] = useState<string>('');
    const [attachments, setAttachments] = useState<AttachmentRow[]>(() => {
        const raw = (
            announcement as unknown as { attachments?: AttachmentRow[] } | null
        )?.attachments;
        return Array.isArray(raw) ? raw : [];
    });

    const audienceIdsCsv = useMemo(
        () => departments.map((d) => d.id).join(', '),
        [departments],
    );

    const attachmentsJson = useMemo(
        () => JSON.stringify(attachments),
        [attachments],
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const target = state.id ? `${BASE}/${state.id}` : BASE;
            router.push(target);
        }
        if (state?.error) {
            toast({
                title: 'Save failed',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router]);

    const addDepartment = () => {
        if (!pendingDeptId) return;
        if (departments.some((d) => d.id === pendingDeptId)) return;
        setDepartments((prev) => [
            ...prev,
            { id: pendingDeptId, name: pendingDeptName },
        ]);
        setPendingDeptId('');
        setPendingDeptName('');
    };

    const removeDepartment = (id: string) =>
        setDepartments((prev) => prev.filter((d) => d.id !== id));

    const removeAttachment = (id: string) =>
        setAttachments((prev) => prev.filter((a) => a.id !== id));

    const initialTags = (announcement?.tags ?? []).join(', ');
    const initialPublishAt = announcement?.publishAt
        ? announcement.publishAt.slice(0, 16)
        : '';
    const initialExpiresAt = announcement?.expiresAt
        ? announcement.expiresAt.slice(0, 16)
        : '';

    return (
        <form action={formAction} className="flex w-full flex-col gap-5">
            {announcement?._id ? (
                <input
                    type="hidden"
                    name="announcementId"
                    value={announcement._id}
                />
            ) : null}
            <input type="hidden" name="bannerUrl" value={bannerUrl} />
            <input type="hidden" name="audienceIds" value={audienceIdsCsv} />
            <input type="hidden" name="attachments" value={attachmentsJson} />

            {/* ── Content ─────────────────────────────────────────── */}
            <Card className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Content</ZoruCardTitle>
                    <p className="text-[12px] text-[var(--st-text-secondary)]">
                        Title and body. Markdown supported in the body.
                    </p>
                </ZoruCardHeader>
                <ZoruCardContent className="flex flex-col gap-4">
                    <div>
                        <Label htmlFor="title">
                            Title{' '}
                            <span className="text-[var(--st-danger)]">*</span>
                        </Label>
                        <Input
                            id="title"
                            name="title"
                            required
                            minLength={3}
                            defaultValue={announcement?.title ?? ''}
                            className="mt-1.5 h-10"
                            placeholder="e.g. Q3 roadmap update"
                        />
                    </div>
                    <div>
                        <Label htmlFor="body">
                            Body <span className="text-[var(--st-danger)]">*</span>
                        </Label>
                        <Textarea
                            id="body"
                            name="body"
                            rows={10}
                            required
                            minLength={1}
                            defaultValue={announcement?.body ?? ''}
                            className="mt-1.5 font-mono text-[12.5px]"
                            placeholder="Markdown or plain text…"
                        />
                        <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">
                            No shared rich-text editor in the repo today —
                            markdown is rendered on the detail page.
                        </p>
                    </div>
                    <div>
                        <Label>Banner image</Label>
                        <div className="mt-1.5 flex items-center gap-2">
                            <SabFilePickerButton
                                accept="image"
                                title="Pick a banner image"
                                onPick={({ url, name }) => {
                                    setBannerUrl(url);
                                    setBannerName(name ?? '');
                                }}
                            >
                                <Upload className="h-4 w-4" />
                                {bannerUrl
                                    ? 'Replace banner'
                                    : 'Add banner'}
                            </SabFilePickerButton>
                            {bannerUrl ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setBannerUrl('');
                                        setBannerName('');
                                    }}
                                >
                                    Remove
                                </Button>
                            ) : null}
                        </div>
                        {bannerUrl ? (
                            <div className="mt-2 truncate rounded-lg border border-[var(--st-border)] px-2 py-1.5 text-[12px] text-[var(--st-text)]">
                                {bannerName || bannerUrl}
                            </div>
                        ) : null}
                    </div>
                </ZoruCardContent>
            </Card>

            {/* ── Scheduling ──────────────────────────────────────── */}
            <Card className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Schedule</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <Label htmlFor="publishAt">
                                Publish at
                            </Label>
                            <Input
                                id="publishAt"
                                name="publishAt"
                                type="datetime-local"
                                defaultValue={initialPublishAt}
                                className="mt-1.5 h-10"
                            />
                        </div>
                        <div>
                            <Label htmlFor="expiresAt">
                                Expires at
                            </Label>
                            <Input
                                id="expiresAt"
                                name="expiresAt"
                                type="datetime-local"
                                defaultValue={initialExpiresAt}
                                className="mt-1.5 h-10"
                            />
                        </div>
                    </div>
                </ZoruCardContent>
            </Card>

            {/* ── Targeting ───────────────────────────────────────── */}
            <Card className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Audience</ZoruCardTitle>
                    <p className="text-[12px] text-[var(--st-text-secondary)]">
                        Choose who sees the announcement.
                    </p>
                </ZoruCardHeader>
                <ZoruCardContent className="flex flex-col gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <Label>Audience</Label>
                            <div className="mt-1.5">
                                <EnumFormField
                                    enumName="announcementAudience"
                                    name="audience"
                                    initialId={audienceMode}
                                    onChange={(value) =>
                                        setAudienceMode(value as string)
                                    }
                                />
                            </div>
                        </div>
                    </div>
                    {audienceMode !== 'all' ? (
                        <div>
                            <Label>Target departments / teams</Label>
                            <p className="mb-2 text-[11.5px] text-[var(--st-text-secondary)]">
                                Pick the recipients of this announcement.
                            </p>
                            <div className="flex flex-wrap items-end gap-2">
                                <div className="min-w-[260px] flex-1">
                                    <EntityFormField
                                        entity="department"
                                        name="__pendingDept"
                                        initialId={pendingDeptId || null}
                                        initialLabel={pendingDeptName}
                                        placeholder="Pick department…"
                                        onChange={(id, hydrated) => {
                                            setPendingDeptId(id ?? '');
                                            setPendingDeptName(
                                                hydrated?.chip.primary ?? '',
                                            );
                                        }}
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addDepartment}
                                    disabled={!pendingDeptId}
                                >
                                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
                                </Button>
                            </div>
                            {departments.length > 0 ? (
                                <ul className="mt-2 flex flex-wrap gap-1.5">
                                    {departments.map((d) => (
                                        <li
                                            key={d.id}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-2 py-0.5 text-[12px]"
                                        >
                                            <span className="text-[var(--st-text)]">
                                                {d.name || d.id}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeDepartment(d.id)
                                                }
                                                aria-label={`Remove ${d.name || d.id}`}
                                                className="text-[var(--st-text-secondary)] hover:text-[var(--st-danger)]"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                    ) : null}
                </ZoruCardContent>
            </Card>

            {/* ── Behaviour ───────────────────────────────────────── */}
            <Card className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>
                        Status, category & behaviour
                    </ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div>
                            <Label>Status</Label>
                            <div className="mt-1.5">
                                <EnumFormField
                                    enumName="announcementStatus"
                                    name="status"
                                    initialId={announcement?.status ?? 'draft'}
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Category</Label>
                            <div className="mt-1.5">
                                <EnumFormField
                                    enumName="announcementCategory"
                                    name="category"
                                    initialId={
                                        (announcement?.category as string) ??
                                        'general'
                                    }
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Priority</Label>
                            <div className="mt-1.5">
                                <EnumFormField
                                    enumName="priority"
                                    name="priority"
                                    initialId={
                                        (announcement?.priority as string) ??
                                        'normal'
                                    }
                                />
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <Label htmlFor="tags">Tags</Label>
                            <Input
                                id="tags"
                                name="tags"
                                defaultValue={initialTags}
                                className="mt-1.5 h-10"
                                placeholder="comma, separated, tags"
                            />
                        </div>
                        <div className="flex flex-col gap-2 pt-2">
                            <div className="flex items-center gap-3">
                                <Switch
                                    id="pinned"
                                    name="pinned"
                                    defaultChecked={!!announcement?.pinned}
                                />
                                <Label htmlFor="pinned">Pinned</Label>
                            </div>
                            <div className="flex items-center gap-3">
                                <Switch
                                    id="allowComments"
                                    name="allowComments"
                                    defaultChecked={
                                        !!announcement?.allowComments
                                    }
                                />
                                <Label htmlFor="allowComments">
                                    Allow comments
                                </Label>
                            </div>
                            <div className="flex items-center gap-3">
                                <Switch
                                    id="requireAcknowledgement"
                                    name="requireAcknowledgement"
                                    defaultChecked={
                                        !!announcement?.requireAcknowledgement
                                    }
                                />
                                <Label htmlFor="requireAcknowledgement">
                                    Require ack
                                </Label>
                            </div>
                        </div>
                        {announcement?.viewCount != null ||
                        announcement?.acknowledgementCount != null ? (
                            <div className="md:col-span-3">
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <Badge variant="secondary">
                                        {announcement?.viewCount ?? 0} views
                                    </Badge>
                                    <Badge variant="secondary">
                                        {announcement?.acknowledgementCount ??
                                            0}{' '}
                                        acks
                                    </Badge>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </ZoruCardContent>
            </Card>

            {/* ── Attachments ─────────────────────────────────────── */}
            <Card className="p-0">
                <ZoruCardHeader className="flex flex-row items-center justify-between gap-2">
                    <div>
                        <ZoruCardTitle>Attachments</ZoruCardTitle>
                        <p className="text-[12px] text-[var(--st-text-secondary)]">
                            Files from your SabFiles library.
                        </p>
                    </div>
                    <SabFilePickerButton
                        onPick={(pick) => {
                            setAttachments((prev) =>
                                prev.some((a) => a.id === pick.id)
                                    ? prev
                                    : [
                                          ...prev,
                                          {
                                              id: pick.id,
                                              url: pick.url,
                                              name: pick.name,
                                              mime: pick.mime,
                                              size: pick.size,
                                          },
                                      ],
                            );
                        }}
                    >
                        <Paperclip className="mr-1.5 h-3.5 w-3.5" /> Add file
                    </SabFilePickerButton>
                </ZoruCardHeader>
                <ZoruCardContent>
                    {attachments.length === 0 ? (
                        <p className="rounded-md border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-3 text-center text-[12px] text-[var(--st-text-secondary)]">
                            No attachments yet.
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-1.5">
                            {attachments.map((a) => (
                                <li
                                    key={a.id}
                                    className="flex items-center justify-between gap-2 rounded-md border border-[var(--st-border)] px-2.5 py-1.5 text-[12.5px]"
                                >
                                    <span className="truncate text-[var(--st-text)]">
                                        {a.name}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                            removeAttachment(a.id)
                                        }
                                        aria-label={`Remove ${a.name}`}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </ZoruCardContent>
            </Card>

            {state?.error ? (
                <p
                    role="alert"
                    className="text-sm text-[var(--st-danger)]"
                >
                    {state.error}
                </p>
            ) : null}

            {/* ── Sticky footer ───────────────────────────────────── */}
            <div className="sticky bottom-0 -mx-4 -mb-4 mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-3 md:-mx-6 md:px-6">
                <Button variant="ghost" asChild>
                    <Link href={BASE}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
                    </Link>
                </Button>
                <SubmitButton
                    label={
                        mode === 'edit' ? 'Save changes' : 'Publish'
                    }
                />
            </div>
        </form>
    );
}

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {label}
        </Button>
    );
}

export default AnnouncementForm;
