'use client';

/**
 * <AnnouncementForm /> — shared create/edit form for HR Announcements.
 *
 * Wraps `saveAnnouncement` from `crm-announcements.actions.ts` with
 * `useActionState` + `useFormStatus`. When `initialData` is supplied the
 * form acts as an edit form (a hidden `announcementId` input is rendered
 * and the action takes the PATCH branch).
 *
 * SabFiles policy: the banner image comes ONLY from the SabFiles
 * library / upload — there is NO free-text URL paste.
 */

import * as React from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Image as ImageIcon,
    LoaderCircle,
    Save,
    X,
} from 'lucide-react';

import {
    ZoruButton,
    ZoruCard,
    ZoruCheckbox,
    ZoruInput,
    ZoruLabel,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruTextarea,
    useZoruToast,
} from '@/components/zoruui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import { saveAnnouncement } from '@/app/actions/crm-announcements.actions';
import type {
    CrmAnnouncementAudience,
    CrmAnnouncementCategory,
    CrmAnnouncementDoc,
    CrmAnnouncementPriority,
    CrmAnnouncementStatus,
} from '@/lib/rust-client/crm-announcements';

const BASE = '/dashboard/hrm/hr/announcements';

const CATEGORY_OPTIONS: Array<{ value: CrmAnnouncementCategory; label: string }> = [
    { value: 'general', label: 'General' },
    { value: 'hr', label: 'HR' },
    { value: 'policy', label: 'Policy' },
    { value: 'event', label: 'Event' },
    { value: 'celebration', label: 'Celebration' },
    { value: 'urgent', label: 'Urgent' },
];

const PRIORITY_OPTIONS: Array<{ value: CrmAnnouncementPriority; label: string }> = [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
];

const AUDIENCE_OPTIONS: Array<{ value: CrmAnnouncementAudience; label: string }> = [
    { value: 'all', label: 'All employees' },
    { value: 'department', label: 'Department' },
    { value: 'team', label: 'Team' },
    { value: 'role', label: 'Role' },
];

const STATUS_OPTIONS: Array<{ value: CrmAnnouncementStatus; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'published', label: 'Published' },
    { value: 'archived', label: 'Archived' },
];

const initialState: { message?: string; error?: string; id?: string } = {};

/* ─── Helpers ────────────────────────────────────────────────────────── */

/** Convert an ISO timestamp into `YYYY-MM-DDTHH:mm` for `<input type="datetime-local">`. */
function toLocalInput(v?: string | null): string {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours(),
    )}:${pad(d.getMinutes())}`;
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

/* ─── Submit button ──────────────────────────────────────────────────── */

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create announcement'}
        </ZoruButton>
    );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export interface AnnouncementFormProps {
    initialData?: CrmAnnouncementDoc | null;
}

export function AnnouncementForm({ initialData }: AnnouncementFormProps) {
    const isEditing = !!initialData?._id;
    const router = useRouter();
    const { toast } = useZoruToast();

    const [state, formAction] = useActionState(saveAnnouncement, initialState);

    // Banner state (SabFiles only).
    const [bannerUrl, setBannerUrl] = React.useState<string>(
        initialData?.bannerUrl ?? '',
    );
    const [bannerName, setBannerName] = React.useState<string>(() =>
        initialData?.bannerUrl ? nameFromUrl(initialData.bannerUrl) : '',
    );

    // Driven selects so labels stay in sync after user changes them.
    const [category, setCategory] = React.useState<CrmAnnouncementCategory>(
        (initialData?.category as CrmAnnouncementCategory) ?? 'general',
    );
    const [priority, setPriority] = React.useState<CrmAnnouncementPriority>(
        (initialData?.priority as CrmAnnouncementPriority) ?? 'normal',
    );
    const [audience, setAudience] = React.useState<CrmAnnouncementAudience>(
        (initialData?.audience as CrmAnnouncementAudience) ?? 'all',
    );
    const [status, setStatus] = React.useState<CrmAnnouncementStatus>(
        (initialData?.status as CrmAnnouncementStatus) ?? 'draft',
    );

    React.useEffect(() => {
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

    const onPickBanner = React.useCallback((pick: SabFilePick) => {
        setBannerUrl(pick.url);
        setBannerName(pick.name);
    }, []);

    const clearBanner = React.useCallback(() => {
        setBannerUrl('');
        setBannerName('');
    }, []);

    const audienceIdsInitial = Array.isArray(initialData?.audienceIds)
        ? (initialData?.audienceIds ?? []).join(', ')
        : '';
    const tagsInitial = Array.isArray(initialData?.tags)
        ? (initialData?.tags ?? []).join(', ')
        : '';

    // Audience scoping: only show audience ids field when not "all".
    const audienceNeedsIds = audience !== 'all';

    return (
        <form action={formAction} className="flex flex-col gap-6">
            {isEditing ? (
                <input
                    type="hidden"
                    name="announcementId"
                    value={String(initialData!._id)}
                />
            ) : null}
            {/* Hidden inputs for controlled selects + banner. */}
            <input type="hidden" name="category" value={category} />
            <input type="hidden" name="priority" value={priority} />
            <input type="hidden" name="audience" value={audience} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="bannerUrl" value={bannerUrl} />

            <ZoruCard className="p-6">
                <div className="mb-4 text-[14px] font-medium text-zoru-ink">
                    Announcement
                </div>

                <div className="flex flex-col gap-4">
                    {/* Title */}
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="title">Title *</ZoruLabel>
                        <ZoruInput
                            id="title"
                            name="title"
                            required
                            placeholder="Headline shown in the feed"
                            defaultValue={initialData?.title ?? ''}
                        />
                    </div>

                    {/* Body */}
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="body">Body *</ZoruLabel>
                        <ZoruTextarea
                            id="body"
                            name="body"
                            rows={8}
                            required
                            placeholder="Announcement content. Markdown is supported."
                            defaultValue={initialData?.body ?? ''}
                        />
                    </div>

                    {/* Category / Priority */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="category-trigger">Category</ZoruLabel>
                            <ZoruSelect
                                value={category}
                                onValueChange={(v) =>
                                    setCategory(v as CrmAnnouncementCategory)
                                }
                            >
                                <ZoruSelectTrigger id="category-trigger">
                                    <ZoruSelectValue placeholder="Category" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {CATEGORY_OPTIONS.map((o) => (
                                        <ZoruSelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="priority-trigger">Priority</ZoruLabel>
                            <ZoruSelect
                                value={priority}
                                onValueChange={(v) =>
                                    setPriority(v as CrmAnnouncementPriority)
                                }
                            >
                                <ZoruSelectTrigger id="priority-trigger">
                                    <ZoruSelectValue placeholder="Priority" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {PRIORITY_OPTIONS.map((o) => (
                                        <ZoruSelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                    </div>
                </div>
            </ZoruCard>

            {/* Audience */}
            <ZoruCard className="p-6">
                <div className="mb-4 text-[14px] font-medium text-zoru-ink">
                    Audience
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="audience-trigger">Send to</ZoruLabel>
                        <ZoruSelect
                            value={audience}
                            onValueChange={(v) =>
                                setAudience(v as CrmAnnouncementAudience)
                            }
                        >
                            <ZoruSelectTrigger id="audience-trigger">
                                <ZoruSelectValue placeholder="Audience" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {AUDIENCE_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    {audienceNeedsIds ? (
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="audienceIds">
                                {audience === 'department'
                                    ? 'Department IDs'
                                    : audience === 'team'
                                      ? 'Team IDs'
                                      : 'Role IDs'}
                            </ZoruLabel>
                            <ZoruInput
                                id="audienceIds"
                                name="audienceIds"
                                placeholder="comma, separated, ids"
                                defaultValue={audienceIdsInitial}
                            />
                            <p className="text-[11.5px] text-zoru-ink-muted">
                                Leave blank to target everyone matching the audience type.
                            </p>
                        </div>
                    ) : null}
                </div>
            </ZoruCard>

            {/* Schedule + Status */}
            <ZoruCard className="p-6">
                <div className="mb-4 text-[14px] font-medium text-zoru-ink">
                    Schedule & status
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="publishAt">Publish at</ZoruLabel>
                        <ZoruInput
                            id="publishAt"
                            name="publishAt"
                            type="datetime-local"
                            defaultValue={toLocalInput(initialData?.publishAt)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="expiresAt">Expires at</ZoruLabel>
                        <ZoruInput
                            id="expiresAt"
                            name="expiresAt"
                            type="datetime-local"
                            defaultValue={toLocalInput(initialData?.expiresAt)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) =>
                                setStatus(v as CrmAnnouncementStatus)
                            }
                        >
                            <ZoruSelectTrigger id="status-trigger">
                                <ZoruSelectValue placeholder="Status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                </div>
            </ZoruCard>

            {/* Flags */}
            <ZoruCard className="p-6">
                <div className="mb-4 text-[14px] font-medium text-zoru-ink">
                    Options
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                    <label className="flex items-center gap-2 text-[13px] text-zoru-ink">
                        <ZoruCheckbox
                            id="pinned"
                            name="pinned"
                            defaultChecked={!!initialData?.pinned}
                        />
                        Pin to top of feed
                    </label>
                    <label className="flex items-center gap-2 text-[13px] text-zoru-ink">
                        <ZoruCheckbox
                            id="allowComments"
                            name="allowComments"
                            defaultChecked={!!initialData?.allowComments}
                        />
                        Allow comments
                    </label>
                    <label className="flex items-center gap-2 text-[13px] text-zoru-ink">
                        <ZoruCheckbox
                            id="requireAcknowledgement"
                            name="requireAcknowledgement"
                            defaultChecked={!!initialData?.requireAcknowledgement}
                        />
                        Require acknowledgement
                    </label>
                </div>
            </ZoruCard>

            {/* Banner — SabFiles only */}
            <ZoruCard className="p-6">
                <div className="mb-1 text-[14px] font-medium text-zoru-ink">
                    Banner image
                </div>
                <p className="mb-4 text-[12px] text-zoru-ink-muted">
                    Pick from your SabFiles library or upload a fresh image.
                    External URLs are not supported.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    {bannerUrl ? (
                        <div className="flex items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface/40 p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={bannerUrl}
                                alt=""
                                className="h-12 w-20 rounded object-cover"
                            />
                            <span className="max-w-[180px] truncate text-xs text-zoru-ink">
                                {bannerName || 'Banner image'}
                            </span>
                            <ZoruButton
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Remove banner"
                                onClick={clearBanner}
                            >
                                <X className="h-4 w-4" />
                            </ZoruButton>
                        </div>
                    ) : (
                        <div className="flex h-12 w-20 items-center justify-center rounded-[var(--zoru-radius)] border border-dashed border-zoru-line text-zoru-ink-muted">
                            <ImageIcon className="h-5 w-5" />
                        </div>
                    )}
                    <SabFilePickerButton
                        accept="image"
                        title="Pick an announcement banner"
                        onPick={onPickBanner}
                        variant="outline"
                    >
                        {bannerUrl ? 'Change banner' : 'Pick from SabFiles'}
                    </SabFilePickerButton>
                </div>
            </ZoruCard>

            {/* Tags */}
            <ZoruCard className="p-6">
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="tags">Tags</ZoruLabel>
                    <ZoruInput
                        id="tags"
                        name="tags"
                        placeholder="comma, separated, tags"
                        defaultValue={tagsInitial}
                    />
                </div>
            </ZoruCard>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2">
                <ZoruButton variant="ghost" asChild>
                    <Link
                        href={
                            isEditing && initialData?._id
                                ? `${BASE}/${initialData._id}`
                                : BASE
                        }
                    >
                        <ArrowLeft className="mr-1.5 h-4 w-4" />
                        Cancel
                    </Link>
                </ZoruButton>
                <SubmitButton isEditing={isEditing} />
            </div>
        </form>
    );
}
