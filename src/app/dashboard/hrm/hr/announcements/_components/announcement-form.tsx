'use client';

import { Button, Card, Checkbox, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState } from 'react';
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

import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { RichTextMentionsEditor } from '@/components/crm/rich-text-mentions-editor';

import { saveAnnouncement } from '@/app/actions/crm-announcements.actions';
import type {
    CrmAnnouncementAudience,
    CrmAnnouncementCategory,
    CrmAnnouncementDoc,
    CrmAnnouncementPriority,
    CrmAnnouncementStatus,
} from '@/lib/rust-client/crm-announcements';

const BASE = '/dashboard/hrm/hr/announcements';

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
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create announcement'}
        </Button>
    );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export interface AnnouncementFormProps {
    initialData?: CrmAnnouncementDoc | null;
}

export function AnnouncementForm({ initialData }: AnnouncementFormProps) {
    const isEditing = !!initialData?._id;
    const router = useRouter();
    const { toast } = useToast();

    const [state, formAction] = useActionState(saveAnnouncement, initialState);

    // Banner state (SabFiles only).
    const [bannerUrl, setBannerUrl] = React.useState<string>(
        initialData?.bannerUrl ?? '',
    );
    const [bannerName, setBannerName] = React.useState<string>(() =>
        initialData?.bannerUrl ? nameFromUrl(initialData.bannerUrl) : '',
    );
    const [bodyContent, setBodyContent] = React.useState<string>(
        initialData?.body ?? '',
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
            {/* Hidden input for SabFiles banner. */}
            <input type="hidden" name="bannerUrl" value={bannerUrl} />

            <Card className="p-6">
                <div className="mb-4 text-[14px] font-medium text-[var(--st-text)]">
                    Announcement
                </div>

                <div className="flex flex-col gap-4">
                    {/* Title */}
                    <div className="space-y-1.5">
                        <Label htmlFor="title">Title *</Label>
                        <Input
                            id="title"
                            name="title"
                            required
                            placeholder="Headline shown in the feed"
                            defaultValue={initialData?.title ?? ''}
                        />
                    </div>

                    {/* Body */}
                    <div className="space-y-1.5">
                        <Label htmlFor="body">Body *</Label>
                        <input type="hidden" name="body" value={bodyContent} />
                        <RichTextMentionsEditor
                            value={bodyContent}
                            onChange={setBodyContent}
                            placeholder="Announcement content. Markdown is supported."
                        />
                    </div>

                    {/* Category (TODO above) / Priority */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Category</Label>
                            <EnumFormField
                                enumName="announcementCategory"
                                name="category"
                                initialId={category}
                                onChange={(id) =>
                                    setCategory(
                                        (id as CrmAnnouncementCategory) ??
                                            'general',
                                    )
                                }
                                placeholder="Category"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Priority</Label>
                            <EnumFormField
                                enumName="priority"
                                name="priority"
                                initialId={priority}
                                onChange={(id) =>
                                    setPriority(
                                        (id as CrmAnnouncementPriority) ??
                                            'normal',
                                    )
                                }
                                placeholder="Priority"
                            />
                        </div>
                    </div>
                </div>
            </Card>

            {/* Audience */}
            <Card className="p-6">
                <div className="mb-4 text-[14px] font-medium text-[var(--st-text)]">
                    Audience
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Send to</Label>
                        <EnumFormField
                            enumName="announcementAudience"
                            name="audience"
                            initialId={audience}
                            onChange={(id) =>
                                setAudience(
                                    (id as CrmAnnouncementAudience) ?? 'all',
                                )
                            }
                            placeholder="Audience"
                        />
                    </div>
                    {audienceNeedsIds ? (
                        <div className="space-y-1.5">
                            <Label htmlFor="audienceIds">
                                {audience === 'department'
                                    ? 'Department IDs'
                                    : audience === 'team'
                                      ? 'Team IDs'
                                      : 'Role IDs'}
                            </Label>
                            <Input
                                id="audienceIds"
                                name="audienceIds"
                                placeholder="comma, separated, ids"
                                defaultValue={audienceIdsInitial}
                            />
                            <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                                Leave blank to target everyone matching the audience type.
                            </p>
                        </div>
                    ) : null}
                </div>
            </Card>

            {/* Schedule + Status */}
            <Card className="p-6">
                <div className="mb-4 text-[14px] font-medium text-[var(--st-text)]">
                    Schedule & status
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="publishAt">Publish at</Label>
                        <Input
                            id="publishAt"
                            name="publishAt"
                            type="datetime-local"
                            defaultValue={toLocalInput(initialData?.publishAt)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="expiresAt">Expires at</Label>
                        <Input
                            id="expiresAt"
                            name="expiresAt"
                            type="datetime-local"
                            defaultValue={toLocalInput(initialData?.expiresAt)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            enumName="announcementStatus"
                            name="status"
                            initialId={status}
                            onChange={(id) =>
                                setStatus(
                                    (id as CrmAnnouncementStatus) ?? 'draft',
                                )
                            }
                            placeholder="Status"
                        />
                    </div>
                </div>
            </Card>

            {/* Flags */}
            <Card className="p-6">
                <div className="mb-4 text-[14px] font-medium text-[var(--st-text)]">
                    Options
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                    <label className="flex items-center gap-2 text-[13px] text-[var(--st-text)]">
                        <Checkbox
                            id="pinned"
                            name="pinned"
                            defaultChecked={!!initialData?.pinned}
                        />
                        Pin to top of feed
                    </label>
                    <label className="flex items-center gap-2 text-[13px] text-[var(--st-text)]">
                        <Checkbox
                            id="allowComments"
                            name="allowComments"
                            defaultChecked={!!initialData?.allowComments}
                        />
                        Allow comments
                    </label>
                    <label className="flex items-center gap-2 text-[13px] text-[var(--st-text)]">
                        <Checkbox
                            id="requireAcknowledgement"
                            name="requireAcknowledgement"
                            defaultChecked={!!initialData?.requireAcknowledgement}
                        />
                        Require acknowledgement
                    </label>
                </div>
            </Card>

            {/* Banner — SabFiles only */}
            <Card className="p-6">
                <div className="mb-1 text-[14px] font-medium text-[var(--st-text)]">
                    Banner image
                </div>
                <p className="mb-4 text-[12px] text-[var(--st-text-secondary)]">
                    Pick from your SabFiles library or upload a fresh image.
                    External URLs are not supported.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    {bannerUrl ? (
                        <div className="flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]/40 p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={bannerUrl}
                                alt=""
                                className="h-12 w-20 rounded object-cover"
                            />
                            <span className="max-w-[180px] truncate text-xs text-[var(--st-text)]">
                                {bannerName || 'Banner image'}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Remove banner"
                                onClick={clearBanner}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex h-12 w-20 items-center justify-center rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] text-[var(--st-text-secondary)]">
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
            </Card>

            {/* Tags */}
            <Card className="p-6">
                <div className="space-y-1.5">
                    <Label htmlFor="tags">Tags</Label>
                    <Input
                        id="tags"
                        name="tags"
                        placeholder="comma, separated, tags"
                        defaultValue={tagsInitial}
                    />
                </div>
            </Card>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" asChild>
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
                </Button>
                <SubmitButton isEditing={isEditing} />
            </div>
        </form>
    );
}
