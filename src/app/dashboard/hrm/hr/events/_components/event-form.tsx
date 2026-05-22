'use client';

import {
  Button,
  Card,
  ZoruCardContent,
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
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
    ArrowLeft,
  Image as ImageIcon,
  LoaderCircle,
  Save,
  X,
  } from 'lucide-react';

// §1E status:
// - event_type ZoruSelect: TODO §1E: add enumName for eventType (CrmEventType not in CRM_ENUMS catalogue yet)
// - status ZoruSelect:     TODO §1E: add enumName for eventStatus (CrmEventStatus not in CRM_ENUMS catalogue yet)
// - organizer/department:  TODO §1E: swap to <EntityFormField entity="employee"> once organizer is an entity ref

/**
 * <EventForm /> — create / edit shell for Workplace Events.
 *
 * Bound to `saveEvent` server action via `useActionState`. On success
 * we toast and route to the detail page (create) or back to the list
 * (edit). The banner image field uses `<SabFilePickerButton>` — never
 * a free-text URL paste, per the SabFiles policy.
 */

import * as React from 'react';
import Link from 'next/link';

import { SabFilePickerButton } from '@/components/sabfiles';

import {
    saveEvent,
    type SaveEventState,
} from '@/app/actions/crm-events.actions';
import type {
    CrmEventDoc,
    CrmEventStatus,
    CrmEventType,
} from '@/lib/rust-client/crm-events';

const initialState: SaveEventState = {};

const EVENT_TYPE_OPTIONS: { value: CrmEventType; label: string }[] = [
    { value: 'meeting', label: 'Meeting' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'social', label: 'Social' },
    { value: 'holiday', label: 'Holiday' },
    { value: 'celebration', label: 'Celebration' },
    { value: 'training', label: 'Training' },
    { value: 'conference', label: 'Conference' },
    { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS: { value: CrmEventStatus; label: string }[] = [
    { value: 'draft', label: 'Draft' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'archived', label: 'Archived' },
];

/**
 * Convert an ISO string into the `YYYY-MM-DDTHH:mm` shape that
 * `<input type="datetime-local">` expects. Returns '' for invalid
 * input.
 */
function toLocalInputValue(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours(),
    )}:${pad(d.getMinutes())}`;
}

export interface EventFormProps {
    initialData?: CrmEventDoc | null;
}

export function EventForm({ initialData }: EventFormProps) {
    const isEditing = Boolean(initialData?._id);
    const [state, formAction] = useActionState(saveEvent, initialState);
    const router = useRouter();
    const { toast } = useZoruToast();

    // Controlled-but-uncontrolled hybrid: keep React state for fields that
    // toggle conditional rendering (is_online, is_recurring, banner_url)
    // while letting `FormData` collect everything else.
    const [isOnline, setIsOnline] = React.useState<boolean>(
        Boolean(initialData?.isOnline),
    );
    const [isRecurring, setIsRecurring] = React.useState<boolean>(
        Boolean(initialData?.isRecurring),
    );
    const [isAllDay, setIsAllDay] = React.useState<boolean>(
        Boolean(initialData?.isAllDay),
    );
    const [bannerUrl, setBannerUrl] = React.useState<string>(
        initialData?.bannerUrl ?? '',
    );
    const [bannerName, setBannerName] = React.useState<string>('');

    // Client-side cross-field validation: ends_at must be ≥ starts_at.
    const [startsAtLocal, setStartsAtLocal] = React.useState<string>(
        toLocalInputValue(initialData?.startsAt),
    );
    const [endsAtLocal, setEndsAtLocal] = React.useState<string>(
        toLocalInputValue(initialData?.endsAt),
    );

    const endBeforeStartError = React.useMemo(() => {
        if (!startsAtLocal || !endsAtLocal) return false;
        return new Date(endsAtLocal).getTime() < new Date(startsAtLocal).getTime();
    }, [startsAtLocal, endsAtLocal]);

    React.useEffect(() => {
        if (state.message) {
            toast({ title: 'Saved', description: state.message });
            if (state.id && !isEditing) {
                router.push(`/dashboard/hrm/hr/events/${state.id}`);
            } else {
                router.push('/dashboard/hrm/hr/events');
            }
            router.refresh();
        }
        if (state.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, isEditing]);

    return (
        <ZoruCard>
            <ZoruCardContent className="p-6">
                <form action={formAction} className="flex flex-col gap-6">
                    {isEditing ? (
                        <input
                            type="hidden"
                            name="id"
                            value={initialData!._id}
                        />
                    ) : null}
                    {/* Persist the banner URL through a hidden field. */}
                    <input type="hidden" name="banner_url" value={bannerUrl} />

                    {/* Identity */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-2">
                            <ZoruLabel htmlFor="name">Event name *</ZoruLabel>
                            <ZoruInput
                                id="name"
                                name="name"
                                required
                                placeholder="e.g. Q3 All-Hands"
                                defaultValue={initialData?.name ?? ''}
                            />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                            <ZoruLabel htmlFor="description">Description / agenda</ZoruLabel>
                            <ZoruTextarea
                                id="description"
                                name="description"
                                rows={4}
                                placeholder="What is this event about?"
                                defaultValue={initialData?.description ?? ''}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="event_type">Event type</ZoruLabel>
                            <ZoruSelect
                                name="event_type"
                                defaultValue={
                                    (initialData?.eventType as string | undefined) ?? 'meeting'
                                }
                            >
                                <ZoruSelectTrigger id="event_type">
                                    <ZoruSelectValue placeholder="Select type" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {EVENT_TYPE_OPTIONS.map((o) => (
                                        <ZoruSelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>

                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="status">Status</ZoruLabel>
                            <ZoruSelect
                                name="status"
                                defaultValue={initialData?.status ?? 'draft'}
                            >
                                <ZoruSelectTrigger id="status">
                                    <ZoruSelectValue placeholder="Select status" />
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

                    {/* Timing */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="starts_at">Starts at *</ZoruLabel>
                            <ZoruInput
                                id="starts_at"
                                name="starts_at"
                                type="datetime-local"
                                required={!isEditing}
                                value={startsAtLocal}
                                onChange={(e) => setStartsAtLocal(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="ends_at">Ends at</ZoruLabel>
                            <ZoruInput
                                id="ends_at"
                                name="ends_at"
                                type="datetime-local"
                                value={endsAtLocal}
                                onChange={(e) => setEndsAtLocal(e.target.value)}
                                aria-invalid={endBeforeStartError || undefined}
                            />
                            {endBeforeStartError ? (
                                <p className="text-xs text-zoru-danger-ink">
                                    End time must be on or after the start.
                                </p>
                            ) : null}
                        </div>

                        <label className="flex items-center gap-2 text-sm text-zoru-ink">
                            <ZoruCheckbox
                                name="is_all_day"
                                checked={isAllDay}
                                onCheckedChange={(v) => setIsAllDay(v === true)}
                            />
                            All-day event
                        </label>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="reminder_minutes">
                                Reminder (minutes before)
                            </ZoruLabel>
                            <ZoruInput
                                id="reminder_minutes"
                                name="reminder_minutes"
                                type="number"
                                min={0}
                                step={1}
                                placeholder="e.g. 30"
                                defaultValue={
                                    initialData?.reminderMinutes != null
                                        ? String(initialData.reminderMinutes)
                                        : ''
                                }
                            />
                        </div>
                    </div>

                    {/* Location */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-2">
                            <ZoruLabel htmlFor="location">Location</ZoruLabel>
                            <ZoruInput
                                id="location"
                                name="location"
                                placeholder="e.g. HQ, Boardroom 4 — or city / venue"
                                defaultValue={initialData?.location ?? ''}
                            />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-zoru-ink">
                            <ZoruCheckbox
                                name="is_online"
                                checked={isOnline}
                                onCheckedChange={(v) => setIsOnline(v === true)}
                            />
                            This event happens online
                        </label>
                        {isOnline ? (
                            <div className="space-y-1.5">
                                <ZoruLabel htmlFor="meeting_url">Meeting URL</ZoruLabel>
                                <ZoruInput
                                    id="meeting_url"
                                    name="meeting_url"
                                    type="url"
                                    placeholder="https://meet.example.com/your-room"
                                    defaultValue={initialData?.meetingUrl ?? ''}
                                />
                            </div>
                        ) : null}
                    </div>

                    {/* Organizer + attendees */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="organizer_name">Organizer</ZoruLabel>
                            <ZoruInput
                                id="organizer_name"
                                name="organizer_name"
                                placeholder="Who is hosting?"
                                defaultValue={initialData?.organizerName ?? ''}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="max_attendees">Max attendees</ZoruLabel>
                            <ZoruInput
                                id="max_attendees"
                                name="max_attendees"
                                type="number"
                                min={0}
                                step={1}
                                placeholder="Leave blank for no cap"
                                defaultValue={
                                    initialData?.maxAttendees != null
                                        ? String(initialData.maxAttendees)
                                        : ''
                                }
                            />
                        </div>
                    </div>

                    {/* Recurrence */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="flex items-center gap-2 text-sm text-zoru-ink">
                            <ZoruCheckbox
                                name="is_recurring"
                                checked={isRecurring}
                                onCheckedChange={(v) => setIsRecurring(v === true)}
                            />
                            This event repeats
                        </label>
                        {isRecurring ? (
                            <div className="space-y-1.5">
                                <ZoruLabel htmlFor="recurrence_rule">
                                    Recurrence rule (RRULE)
                                </ZoruLabel>
                                <ZoruInput
                                    id="recurrence_rule"
                                    name="recurrence_rule"
                                    placeholder="e.g. FREQ=WEEKLY;BYDAY=MO"
                                    defaultValue={initialData?.recurrenceRule ?? ''}
                                />
                            </div>
                        ) : null}
                    </div>

                    {/* Banner — SabFiles-only, never free-text URL */}
                    <div className="space-y-2">
                        <ZoruLabel>Banner image</ZoruLabel>
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
                                        onClick={() => {
                                            setBannerUrl('');
                                            setBannerName('');
                                        }}
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
                                title="Pick a banner image"
                                onPick={(pick) => {
                                    setBannerUrl(pick.url);
                                    setBannerName(pick.name);
                                }}
                            >
                                {bannerUrl ? 'Change banner' : 'Pick from SabFiles'}
                            </SabFilePickerButton>
                        </div>
                        <p className="text-[11px] text-zoru-ink-muted">
                            Banner is sourced from your SabFiles library — uploads land
                            there too.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <ZoruButton
                            type="button"
                            variant="ghost"
                            asChild
                            className="text-zoru-ink-muted hover:text-zoru-ink"
                        >
                            <Link
                                href={
                                    isEditing && initialData
                                        ? `/dashboard/hrm/hr/events/${initialData._id}`
                                        : '/dashboard/hrm/hr/events'
                                }
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Cancel
                            </Link>
                        </ZoruButton>
                        <SubmitButtonGuarded isEditing={isEditing} disabled={endBeforeStartError} />
                    </div>
                </form>
            </ZoruCardContent>
        </ZoruCard>
    );
}

/**
 * Submit button that also respects the client-side `disabled` flag the
 * parent computes for end-before-start validation, in addition to the
 * pending state from `useFormStatus`.
 */
function SubmitButtonGuarded({
    isEditing,
    disabled,
}: {
    isEditing: boolean;
    disabled: boolean;
}) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending || disabled}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create event'}
        </ZoruButton>
    );
}

