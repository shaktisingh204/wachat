'use client';

/**
 * Event form (§1D.3) — shared by /new and /[id]/edit.
 *
 * Wraps <EntityFormShell> with sections: Basics · Schedule · Recurrence ·
 * Reminders · Location. Preserves the FormData keys consumed by
 * `saveEvent` in `worksuite/knowledge.actions`.
 *
 * Fields preserved: event_name · description · where · label_color ·
 * start_date_time · end_date_time · repeat · repeat_type · repeat_every ·
 * repeat_cycles · send_reminder · remind_time · remind_type ·
 * google_calendar · online_link.
 */

import * as React from 'react';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { EntityFormShell } from '@/components/crm/entity-form-shell';
import {
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

import { saveEvent } from '@/app/actions/worksuite/knowledge.actions';
import type { WsEvent } from '@/lib/worksuite/knowledge-types';

export interface EventsFormProps {
    mode: 'new' | 'edit';
    event?: (WsEvent & { _id: string }) | null;
    /** Optional pre-fill date (yyyy-mm-dd) when launched from calendar cell. */
    initialDate?: string;
}

const TWO_COL = 'grid gap-4 md:grid-cols-2';

function toLocalDt(v: unknown): string {
    if (!v) return '';
    const d = new Date(v as string);
    if (!Number.isFinite(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventsForm({ mode, event, initialDate }: EventsFormProps): React.JSX.Element {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [state, formAction] = useActionState(saveEvent, {
        message: '',
        error: '',
    } as { message?: string; error?: string });

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            router.push('/dashboard/crm/workspace/events');
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    const defaultStart = event?.start_date_time
        ? toLocalDt(event.start_date_time)
        : initialDate
        ? `${initialDate}T09:00`
        : '';
    const defaultEnd = event?.end_date_time
        ? toLocalDt(event.end_date_time)
        : initialDate
        ? `${initialDate}T10:00`
        : '';

    return (
        <EntityFormShell
            title={mode === 'edit' ? 'Edit event' : 'New event'}
            subtitle="Schedule a one-off or recurring event."
            action={formAction}
            cancelHref="/dashboard/crm/workspace/events"
            submitLabel={mode === 'edit' ? 'Save changes' : 'Create event'}
            hiddenInputs={event?._id ? <input type="hidden" name="id" value={event._id} /> : null}
            error={state?.error}
            message={state?.message}
            sections={[
                {
                    id: 'basics',
                    title: 'Basics',
                    description: 'Name, description, and label colour.',
                    children: (
                        <div className={TWO_COL}>
                            <div className="md:col-span-2">
                                <ZoruLabel htmlFor="event_name">Event name *</ZoruLabel>
                                <ZoruInput
                                    id="event_name"
                                    name="event_name"
                                    required
                                    defaultValue={event?.event_name ?? ''}
                                    className="mt-1.5 h-10"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <ZoruLabel htmlFor="description">Description</ZoruLabel>
                                <ZoruTextarea
                                    id="description"
                                    name="description"
                                    rows={4}
                                    defaultValue={event?.description ?? ''}
                                    className="mt-1.5"
                                />
                            </div>
                            <div>
                                <ZoruLabel htmlFor="label_color">Label colour</ZoruLabel>
                                <ZoruInput
                                    id="label_color"
                                    name="label_color"
                                    type="color"
                                    defaultValue={event?.label_color ?? '#e11d48'}
                                    className="mt-1.5 h-10 w-full"
                                />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'schedule',
                    title: 'Schedule',
                    description: 'Start and end times.',
                    children: (
                        <div className={TWO_COL}>
                            <div>
                                <ZoruLabel htmlFor="start_date_time">Start *</ZoruLabel>
                                <ZoruInput
                                    id="start_date_time"
                                    name="start_date_time"
                                    type="datetime-local"
                                    required
                                    defaultValue={defaultStart}
                                    className="mt-1.5 h-10"
                                />
                            </div>
                            <div>
                                <ZoruLabel htmlFor="end_date_time">End *</ZoruLabel>
                                <ZoruInput
                                    id="end_date_time"
                                    name="end_date_time"
                                    type="datetime-local"
                                    required
                                    defaultValue={defaultEnd}
                                    className="mt-1.5 h-10"
                                />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'recurrence',
                    title: 'Recurrence',
                    description: 'Repeat this event on a schedule.',
                    children: (
                        <div className={TWO_COL}>
                            <div>
                                <ZoruLabel htmlFor="repeat">Repeat</ZoruLabel>
                                <ZoruSelect name="repeat" defaultValue={event?.repeat ? 'true' : 'false'}>
                                    <ZoruSelectTrigger id="repeat" className="mt-1.5 h-10">
                                        <ZoruSelectValue />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="false">No</ZoruSelectItem>
                                        <ZoruSelectItem value="true">Yes</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div>
                                <ZoruLabel htmlFor="repeat_type">Repeat type</ZoruLabel>
                                <ZoruSelect name="repeat_type" defaultValue={event?.repeat_type ?? 'week'}>
                                    <ZoruSelectTrigger id="repeat_type" className="mt-1.5 h-10">
                                        <ZoruSelectValue />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="day">Day</ZoruSelectItem>
                                        <ZoruSelectItem value="week">Week</ZoruSelectItem>
                                        <ZoruSelectItem value="month">Month</ZoruSelectItem>
                                        <ZoruSelectItem value="year">Year</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div>
                                <ZoruLabel htmlFor="repeat_every">Repeat every</ZoruLabel>
                                <ZoruInput
                                    id="repeat_every"
                                    name="repeat_every"
                                    type="number"
                                    min={1}
                                    defaultValue={event?.repeat_every ?? 1}
                                    className="mt-1.5 h-10"
                                />
                            </div>
                            <div>
                                <ZoruLabel htmlFor="repeat_cycles">Cycles</ZoruLabel>
                                <ZoruInput
                                    id="repeat_cycles"
                                    name="repeat_cycles"
                                    type="number"
                                    min={1}
                                    defaultValue={event?.repeat_cycles ?? 1}
                                    className="mt-1.5 h-10"
                                />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'reminders',
                    title: 'Reminders & integration',
                    description: 'Notifications and Google Calendar sync.',
                    children: (
                        <div className={TWO_COL}>
                            <div>
                                <ZoruLabel htmlFor="send_reminder">Send reminder</ZoruLabel>
                                <ZoruSelect name="send_reminder" defaultValue={event?.send_reminder ? 'true' : 'false'}>
                                    <ZoruSelectTrigger id="send_reminder" className="mt-1.5 h-10">
                                        <ZoruSelectValue />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="false">No</ZoruSelectItem>
                                        <ZoruSelectItem value="true">Yes</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div>
                                <ZoruLabel htmlFor="remind_time">Remind in</ZoruLabel>
                                <ZoruInput
                                    id="remind_time"
                                    name="remind_time"
                                    type="number"
                                    min={0}
                                    defaultValue={event?.remind_time ?? ''}
                                    className="mt-1.5 h-10"
                                />
                            </div>
                            <div>
                                <ZoruLabel htmlFor="remind_type">Remind unit</ZoruLabel>
                                <ZoruSelect name="remind_type" defaultValue={event?.remind_type ?? 'hour'}>
                                    <ZoruSelectTrigger id="remind_type" className="mt-1.5 h-10">
                                        <ZoruSelectValue />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="hour">Hour</ZoruSelectItem>
                                        <ZoruSelectItem value="day">Day</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div>
                                <ZoruLabel htmlFor="google_calendar">Google Calendar</ZoruLabel>
                                <ZoruSelect name="google_calendar" defaultValue={event?.google_calendar ? 'true' : 'false'}>
                                    <ZoruSelectTrigger id="google_calendar" className="mt-1.5 h-10">
                                        <ZoruSelectValue />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="false">No</ZoruSelectItem>
                                        <ZoruSelectItem value="true">Yes</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'location',
                    title: 'Location & online link',
                    description: 'Where the event happens or the meeting URL.',
                    children: (
                        <div className={TWO_COL}>
                            <div>
                                <ZoruLabel htmlFor="where">Location</ZoruLabel>
                                <ZoruInput
                                    id="where"
                                    name="where"
                                    defaultValue={event?.where ?? ''}
                                    className="mt-1.5 h-10"
                                />
                            </div>
                            <div>
                                <ZoruLabel htmlFor="online_link">Online link</ZoruLabel>
                                <ZoruInput
                                    id="online_link"
                                    name="online_link"
                                    type="url"
                                    defaultValue={event?.online_link ?? ''}
                                    className="mt-1.5 h-10"
                                />
                            </div>
                        </div>
                    ),
                },
            ]}
        />
    );
}

export default EventsForm;
