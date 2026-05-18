'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruInput,
  ZoruLabel,
  ZoruSwitch,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFormField } from '@/components/crm/enum-form-field';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload,
  X } from 'lucide-react';

import { EntityFormShell } from '@/components/crm/entity-form-shell';

/**
 * Announcement form (§1B W7) — shared by /new and /[id]/edit.
 *
 * Preserves FormData keys consumed by `saveAnnouncement` (camelCase):
 * title, body, audience, audienceIds (comma-separated), publishAt,
 * expiresAt, pinned, status, category, priority, bannerUrl, tags,
 * allowComments, requireAcknowledgement. The hidden `announcementId`
 * input is what flips the action from POST to PATCH.
 *
 * Banner attachment uses <SabFilePickerButton> per project SabFiles
 * policy — no free-text URL paste.
 */

import * as React from 'react';

import { SabFilePickerButton } from '@/components/sabfiles';

import { saveAnnouncement } from '@/app/actions/crm-announcements.actions';
import type { CrmAnnouncementDoc } from '@/lib/rust-client/crm-announcements';

export interface AnnouncementFormProps {
    mode: 'new' | 'edit';
    announcement?: CrmAnnouncementDoc | null;
}

export function AnnouncementForm({
    mode,
    announcement,
}: AnnouncementFormProps): React.JSX.Element {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [state, formAction] = useActionState(saveAnnouncement, {
        message: '',
        error: '',
    } as { message?: string; error?: string; id?: string });

    const [bannerUrl, setBannerUrl] = useState<string>(announcement?.bannerUrl ?? '');
    const [bannerName, setBannerName] = useState<string>('');

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const target = state.id
                ? `/dashboard/crm/workspace/announcements/${state.id}`
                : '/dashboard/crm/workspace/announcements';
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

    const initialAudienceIds = (announcement?.audienceIds ?? []).join(', ');
    const initialTags = (announcement?.tags ?? []).join(', ');
    const initialPublishAt = announcement?.publishAt
        ? announcement.publishAt.slice(0, 16)
        : '';
    const initialExpiresAt = announcement?.expiresAt
        ? announcement.expiresAt.slice(0, 16)
        : '';

    return (
        <EntityFormShell
            title={mode === 'edit' ? 'Edit announcement' : 'New announcement'}
            subtitle="Broadcast an update to your team — audience, schedule, and read tracking."
            action={formAction}
            cancelHref="/dashboard/crm/workspace/announcements"
            submitLabel={mode === 'edit' ? 'Save changes' : 'Publish'}
            error={state?.error}
            message={state?.message}
            hiddenInputs={
                <>
                    {announcement?._id ? (
                        <input
                            type="hidden"
                            name="announcementId"
                            value={announcement._id}
                        />
                    ) : null}
                    <input type="hidden" name="bannerUrl" value={bannerUrl} />
                </>
            }
            sections={[
                {
                    id: 'content',
                    title: 'Content',
                    description: 'Title and body for the announcement.',
                    children: (
                        <div className="grid gap-4">
                            <div>
                                <ZoruLabel htmlFor="title">
                                    Title <span className="text-zoru-danger-ink">*</span>
                                </ZoruLabel>
                                <ZoruInput
                                    id="title"
                                    name="title"
                                    required
                                    defaultValue={announcement?.title ?? ''}
                                    className="mt-1.5 h-10"
                                    placeholder="e.g. Q3 roadmap update"
                                />
                            </div>
                            <div>
                                <ZoruLabel htmlFor="body">
                                    Body <span className="text-zoru-danger-ink">*</span>
                                </ZoruLabel>
                                <ZoruTextarea
                                    id="body"
                                    name="body"
                                    rows={8}
                                    required
                                    defaultValue={announcement?.body ?? ''}
                                    className="mt-1.5"
                                    placeholder="Markdown or plain text…"
                                />
                            </div>
                            <div>
                                <ZoruLabel>Banner image</ZoruLabel>
                                <div className="mt-1.5">
                                    <SabFilePickerButton
                                        accept="image"
                                        title="Pick a banner image"
                                        onPick={({ url, name }) => {
                                            setBannerUrl(url);
                                            setBannerName(name ?? '');
                                        }}
                                    >
                                        <Upload className="h-4 w-4" />
                                        {bannerUrl ? 'Replace banner' : 'Add banner'}
                                    </SabFilePickerButton>
                                </div>
                                {bannerUrl ? (
                                    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-zoru-line px-2 py-1.5">
                                        <span className="truncate text-[12px] text-zoru-ink">
                                            {bannerName || bannerUrl}
                                        </span>
                                        <ZoruButton
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            aria-label="Remove banner"
                                            onClick={() => {
                                                setBannerUrl('');
                                                setBannerName('');
                                            }}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </ZoruButton>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'audience',
                    title: 'Audience & schedule',
                    description: 'Who sees this announcement and when.',
                    children: (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <ZoruLabel>Audience</ZoruLabel>
                                <div className="mt-1.5">
                                    <EnumFormField
                                        enumName="announcementAudience"
                                        name="audience"
                                        initialId={announcement?.audience ?? 'all'}
                                    />
                                </div>
                            </div>
                            <div>
                                <ZoruLabel htmlFor="audienceIds">
                                    Audience target ids
                                </ZoruLabel>
                                <ZoruInput
                                    id="audienceIds"
                                    name="audienceIds"
                                    defaultValue={initialAudienceIds}
                                    className="mt-1.5 h-10 font-mono text-[12px]"
                                    placeholder="dept1, dept2 (comma-separated)"
                                />
                            </div>
                            <div>
                                <ZoruLabel htmlFor="publishAt">Publish at</ZoruLabel>
                                <ZoruInput
                                    id="publishAt"
                                    name="publishAt"
                                    type="datetime-local"
                                    defaultValue={initialPublishAt}
                                    className="mt-1.5 h-10"
                                />
                            </div>
                            <div>
                                <ZoruLabel htmlFor="expiresAt">Expires at</ZoruLabel>
                                <ZoruInput
                                    id="expiresAt"
                                    name="expiresAt"
                                    type="datetime-local"
                                    defaultValue={initialExpiresAt}
                                    className="mt-1.5 h-10"
                                />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'meta',
                    title: 'Status, category & priority',
                    children: (
                        <div className="grid gap-4 md:grid-cols-3">
                            <div>
                                <ZoruLabel>Status</ZoruLabel>
                                <div className="mt-1.5">
                                    <EnumFormField
                                        enumName="announcementStatus"
                                        name="status"
                                        initialId={announcement?.status ?? 'draft'}
                                    />
                                </div>
                            </div>
                            <div>
                                <ZoruLabel>Category</ZoruLabel>
                                <div className="mt-1.5">
                                    <EnumFormField
                                        enumName="announcementCategory"
                                        name="category"
                                        initialId={(announcement?.category as string) ?? 'general'}
                                    />
                                </div>
                            </div>
                            <div>
                                <ZoruLabel>Priority</ZoruLabel>
                                <div className="mt-1.5">
                                    <EnumFormField
                                        enumName="priority"
                                        name="priority"
                                        initialId={(announcement?.priority as string) ?? 'normal'}
                                    />
                                </div>
                            </div>
                            <div>
                                <ZoruLabel htmlFor="tags">Tags</ZoruLabel>
                                <ZoruInput
                                    id="tags"
                                    name="tags"
                                    defaultValue={initialTags}
                                    className="mt-1.5 h-10"
                                    placeholder="comma, separated, tags"
                                />
                            </div>
                            <div className="flex items-center gap-3 pt-7">
                                <ZoruSwitch
                                    id="pinned"
                                    name="pinned"
                                    defaultChecked={!!announcement?.pinned}
                                />
                                <ZoruLabel htmlFor="pinned">Pinned</ZoruLabel>
                            </div>
                            <div className="flex flex-col gap-2 pt-2">
                                <div className="flex items-center gap-3">
                                    <ZoruSwitch
                                        id="allowComments"
                                        name="allowComments"
                                        defaultChecked={!!announcement?.allowComments}
                                    />
                                    <ZoruLabel htmlFor="allowComments">
                                        Allow comments
                                    </ZoruLabel>
                                </div>
                                <div className="flex items-center gap-3">
                                    <ZoruSwitch
                                        id="requireAcknowledgement"
                                        name="requireAcknowledgement"
                                        defaultChecked={
                                            !!announcement?.requireAcknowledgement
                                        }
                                    />
                                    <ZoruLabel htmlFor="requireAcknowledgement">
                                        Require ack
                                    </ZoruLabel>
                                </div>
                            </div>
                            {announcement?.viewCount != null ||
                            announcement?.acknowledgementCount != null ? (
                                <div className="md:col-span-3">
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        <ZoruBadge variant="secondary">
                                            {announcement?.viewCount ?? 0} views
                                        </ZoruBadge>
                                        <ZoruBadge variant="secondary">
                                            {announcement?.acknowledgementCount ?? 0} acks
                                        </ZoruBadge>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ),
                },
            ]}
        />
    );
}

export default AnnouncementForm;
