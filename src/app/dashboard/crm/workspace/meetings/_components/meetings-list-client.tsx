'use client';

import * as React from 'react';
import {
    Video,
    Plus,
    Calendar,
    Clock,
    Users,
    X,
    ExternalLink,
    Trash2,
    CheckCircle,
    XCircle,
    Edit2,
    CalendarDays,
} from 'lucide-react';
import { Button, Card, Input, Label, Textarea, useToast, Table, THead, TBody, Tr, Td, Th } from '@/components/sabcrm/20ui/compat';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    createMeetingScheduler,
    updateMeetingScheduler,
    deleteMeetingScheduler,
    getMeetingSchedulers,
} from '@/app/actions/crm-advanced/meeting-scheduler';
import type { MeetingSchedulerType } from '@/app/actions/crm-advanced/meeting-scheduler.schema';

import { getAvailability } from '@/lib/crm-depth/meetings';

interface MeetingsListClientProps {
    initialMeetings: MeetingSchedulerType[];
}

const STATUS_TONES: Record<string, StatusTone> = {
    scheduled: 'amber',
    completed: 'green',
    canceled: 'neutral',
};

export function MeetingsListClient({ initialMeetings }: MeetingsListClientProps) {
    const { toast } = useToast();
    const [meetings, setMeetings] = React.useState<MeetingSchedulerType[]>(initialMeetings);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isMutating, startMutate] = React.useTransition();

    // Filters
    const [searchQuery, setSearchQuery] = React.useState('');

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingMeeting, setEditingMeeting] = React.useState<MeetingSchedulerType | null>(null);

    // Form fields
    const [meetingTitle, setMeetingTitle] = React.useState('');
    const [attendees, setAttendees] = React.useState('');
    const [meetingDate, setMeetingDate] = React.useState('');
    const [meetingTime, setMeetingTime] = React.useState('');
    const [duration, setDuration] = React.useState(30);
    const [videoLink, setVideoLink] = React.useState('');
    const [notes, setNotes] = React.useState('');
    const [status, setStatus] = React.useState<'scheduled' | 'canceled' | 'completed'>('scheduled');

    // Slot picker state
    const [slotDate, setSlotDate] = React.useState('');
    const [availableSlots, setAvailableSlots] = React.useState<{ id: string; start: string; end: string }[]>([]);

    const refreshData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getMeetingSchedulers();
            if (res.success) {
                setMeetings(res.data);
            }
        } catch {
            setMeetings([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Generate slots when slotDate changes
    React.useEffect(() => {
        if (!slotDate) {
            setAvailableSlots([]);
            return;
        }

        try {
            const start = new Date(`${slotDate}T00:00:00`);
            const end = new Date(`${slotDate}T23:59:59`);
            const slots = getAvailability('workspace-user', { start, end }, {
                durationMinutes: duration,
                bufferMinutes: 10,
            });
            setAvailableSlots(slots.map(s => ({
                id: s.id,
                start: new Date(s.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }),
                end: new Date(s.end).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }),
            })));
        } catch (e) {
            console.error('Error generating slots:', e);
            setAvailableSlots([]);
        }
    }, [slotDate, duration]);

    const openNew = () => {
        setEditingMeeting(null);
        setMeetingTitle('');
        setAttendees('');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setMeetingDate(tomorrow.toISOString().slice(0, 10));
        setMeetingTime('10:00');
        setDuration(30);
        setVideoLink('');
        setNotes('');
        setStatus('scheduled');
        setSlotDate('');
        setAvailableSlots([]);
        setIsDialogOpen(true);
    };

    const openEdit = (m: MeetingSchedulerType & Record<string, any>) => {
        setEditingMeeting(m);
        setMeetingTitle(m.meetingTitle);
        setAttendees(m.attendees);
        setStatus(m.status);
        setNotes(m.notes ?? '');
        setDuration(m.duration ? Number(m.duration) : 30);
        setVideoLink(m.videoLink ?? '');
        
        if (m.dateTime) {
            const dt = new Date(m.dateTime);
            if (!isNaN(dt.getTime())) {
                setMeetingDate(dt.toISOString().slice(0, 10));
                setMeetingTime(dt.toTimeString().slice(0, 5));
            }
        }
        setIsDialogOpen(true);
    };

    const generateVideoLink = () => {
        const titleSlug = meetingTitle.trim() ? encodeURIComponent(meetingTitle.trim().replace(/\s+/g, '-')) : 'SabNode-Meet';
        const uniqueId = Math.random().toString(36).substring(2, 9);
        const link = `https://meet.jit.si/SabNode-${titleSlug}-${uniqueId}`;
        setVideoLink(link);
        toast({ title: 'Video Link Generated', description: 'A Jitsi video call link has been set up.' });
    };

    const handleSave = () => {
        if (!meetingTitle.trim()) {
            toast({ title: 'Validation Error', description: 'Meeting title is required.', variant: 'destructive' });
            return;
        }
        if (!attendees.trim()) {
            toast({ title: 'Validation Error', description: 'At least one attendee email or name is required.', variant: 'destructive' });
            return;
        }

        const dtStr = meetingDate && meetingTime ? new Date(`${meetingDate}T${meetingTime}`).toISOString() : new Date().toISOString();

        const payload = {
            meetingTitle: meetingTitle.trim(),
            attendees: attendees.trim(),
            status,
            dateTime: dtStr,
            duration,
            videoLink,
            notes,
        };

        startMutate(async () => {
            let res;
            if (editingMeeting) {
                res = await updateMeetingScheduler(editingMeeting._id, payload);
            } else {
                res = await createMeetingScheduler(payload);
            }

            if (res.success) {
                toast({
                    title: editingMeeting ? 'Meeting Updated' : 'Meeting Scheduled',
                    description: editingMeeting ? 'The meeting was successfully updated.' : 'Your meeting is now scheduled.',
                });
                setIsDialogOpen(false);
                void refreshData();
            } else {
                toast({ title: 'Failed to save', variant: 'destructive' });
            }
        });
    };

    const handleDelete = (id: string) => {
        if (!confirm('Are you sure you want to delete this meeting?')) return;
        startMutate(async () => {
            const res = await deleteMeetingScheduler(id);
            if (res.success) {
                toast({ title: 'Meeting Deleted' });
                void refreshData();
            } else {
                toast({ title: 'Delete Failed', variant: 'destructive' });
            }
        });
    };

    const updateStatus = (m: MeetingSchedulerType, newStatus: 'scheduled' | 'canceled' | 'completed') => {
        startMutate(async () => {
            const res = await updateMeetingScheduler(m._id, {
                meetingTitle: m.meetingTitle,
                attendees: m.attendees,
                status: newStatus,
                dateTime: (m as any).dateTime,
                duration: (m as any).duration,
                videoLink: (m as any).videoLink,
                notes: (m as any).notes,
            });
            if (res.success) {
                toast({ title: `Status Updated`, description: `Meeting status is now ${newStatus}.` });
                void refreshData();
            }
        });
    };

    const filteredMeetings = React.useMemo(() => {
        const needle = searchQuery.trim().toLowerCase();
        if (!needle) return meetings;
        return meetings.filter(m =>
            m.meetingTitle.toLowerCase().includes(needle) ||
            m.attendees.toLowerCase().includes(needle)
        );
    }, [meetings, searchQuery]);

    // KPI stats
    const stats = React.useMemo(() => {
        const counts = { total: meetings.length, scheduled: 0, completed: 0, canceled: 0 };
        for (const m of meetings) {
            counts[m.status] = (counts[m.status] ?? 0) + 1;
        }
        return counts;
    }, [meetings]);

    return (
        <EntityListShell
            title="Workspace Meetings"
            subtitle="Schedule client consults, team catch-ups and direct video calls."
            primaryAction={
                <Button onClick={openNew}>
                    <Plus className="mr-1.5 h-4 w-4" /> Schedule Meeting
                </Button>
            }
            search={{
                value: searchQuery,
                onChange: setSearchQuery,
                placeholder: 'Search meetings by title or attendee…',
            }}
        >
            <div className="flex flex-col gap-6">
                {/* KPI Strip */}
                <div className="grid gap-3 sm:grid-cols-4">
                    <Card className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                            <CalendarDays className="h-5 w-5" />
                        </div>
                        <div>
                            <span className="text-[12px] text-[var(--st-text-secondary)]">Total Scheduled</span>
                            <h4 className="text-[18px] font-bold text-[var(--st-text)]">{stats.total}</h4>
                        </div>
                    </Card>
                    <Card className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div>
                            <span className="text-[12px] text-[var(--st-text-secondary)]">Upcoming</span>
                            <h4 className="text-[18px] font-bold text-[var(--st-text)]">{stats.scheduled}</h4>
                        </div>
                    </Card>
                    <Card className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                            <CheckCircle className="h-5 w-5" />
                        </div>
                        <div>
                            <span className="text-[12px] text-[var(--st-text-secondary)]">Completed</span>
                            <h4 className="text-[18px] font-bold text-[var(--st-text)]">{stats.completed}</h4>
                        </div>
                    </Card>
                    <Card className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                            <XCircle className="h-5 w-5" />
                        </div>
                        <div>
                            <span className="text-[12px] text-[var(--st-text-secondary)]">Canceled</span>
                            <h4 className="text-[18px] font-bold text-[var(--st-text)]">{stats.canceled}</h4>
                        </div>
                    </Card>
                </div>

                {/* Meetings table */}
                <Card className="p-0">
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">Meeting Details</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Scheduled Time</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Attendees</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Video Link</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Status</Th>
                                    <Th className="text-[var(--st-text-secondary)] text-right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {isLoading ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td colSpan={6} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                        </Td>
                                    </Tr>
                                ) : filteredMeetings.length === 0 ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td colSpan={6} className="h-24 text-center text-[var(--st-text-secondary)]">
                                            No meetings scheduled.
                                        </Td>
                                    </Tr>
                                ) : (
                                    filteredMeetings.map((m) => {
                                        const dt = (m as any).dateTime ? new Date((m as any).dateTime) : null;
                                        const dateStr = dt && !isNaN(dt.getTime()) ? dt.toLocaleDateString() : '—';
                                        const timeStr = dt && !isNaN(dt.getTime()) ? dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—';
                                        const dur = (m as any).duration ?? 30;

                                        return (
                                            <Tr key={m._id} className="border-[var(--st-border)]">
                                                <Td className="font-semibold text-[var(--st-text)]">
                                                    <div className="flex flex-col">
                                                        <span>{m.meetingTitle}</span>
                                                        {(m as any).notes && (
                                                            <span className="text-[11.5px] font-normal text-[var(--st-text-secondary)] line-clamp-1">
                                                                {(m as any).notes}
                                                            </span>
                                                        )}
                                                    </div>
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    <div className="flex flex-col">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="h-3 w-3 text-[var(--st-text-secondary)]" /> {dateStr}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-[11.5px] text-[var(--st-text-secondary)]">
                                                            <Clock className="h-3 w-3" /> {timeStr} ({dur}m)
                                                        </span>
                                                    </div>
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    <div className="flex items-center gap-1">
                                                        <Users className="h-3 w-3 text-[var(--st-text-secondary)]" />
                                                        <span className="max-w-[200px] truncate" title={m.attendees}>
                                                            {m.attendees}
                                                        </span>
                                                    </div>
                                                </Td>
                                                <Td>
                                                    {(m as any).videoLink ? (
                                                        <Button variant="outline" size="sm" asChild className="h-8">
                                                            <a href={(m as any).videoLink} target="_blank" rel="noopener noreferrer">
                                                                <Video className="mr-1.5 h-3.5 w-3.5 text-[var(--st-text)]" /> Join Call
                                                            </a>
                                                        </Button>
                                                    ) : (
                                                        <span className="text-[12px] text-[var(--st-text-secondary)]">No video call</span>
                                                    )}
                                                </Td>
                                                <Td>
                                                    <StatusPill label={m.status} tone={STATUS_TONES[m.status] ?? 'neutral'} />
                                                </Td>
                                                <Td className="text-right">
                                                    <div className="flex justify-end gap-1.5">
                                                        {m.status === 'scheduled' && (
                                                            <>
                                                                <Button variant="ghost" size="icon" onClick={() => updateStatus(m, 'completed')} title="Mark Completed">
                                                                    <CheckCircle className="h-4 w-4 text-[var(--st-text)]" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" onClick={() => updateStatus(m, 'canceled')} title="Cancel Meeting">
                                                                    <XCircle className="h-4 w-4 text-[var(--st-text-secondary)]" />
                                                                </Button>
                                                            </>
                                                        )}
                                                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                                                            <Edit2 className="h-4 w-4 text-[var(--st-text)]" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(m._id)} disabled={isMutating}>
                                                            <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                                        </Button>
                                                    </div>
                                                </Td>
                                            </Tr>
                                        );
                                    })
                                )}
                            </TBody>
                        </Table>
                    </div>
                </Card>
            </div>

            {/* Schedule Meeting Dialog */}
            {isDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <Card className="w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-[16px] font-bold text-[var(--st-text)]">
                                {editingMeeting ? 'Modify Scheduled Meeting' : 'Schedule Meeting'}
                            </h2>
                            <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex flex-col gap-4">
                            {/* Meeting Title */}
                            <div className="space-y-1">
                                <Label htmlFor="meeting-title">Meeting Title *</Label>
                                <Input
                                    id="meeting-title"
                                    value={meetingTitle}
                                    onChange={(e) => setMeetingTitle(e.target.value)}
                                    placeholder="e.g. Q3 Sales Alignment"
                                    required
                                />
                            </div>

                            {/* Attendees */}
                            <div className="space-y-1">
                                <Label htmlFor="attendees">Attendees (emails or names, comma separated) *</Label>
                                <Input
                                    id="attendees"
                                    value={attendees}
                                    onChange={(e) => setAttendees(e.target.value)}
                                    placeholder="e.g. rahul@example.com, john@example.com"
                                    required
                                />
                            </div>

                            {/* Slot Availability Checker */}
                            {!editingMeeting && (
                                <div className="rounded-lg border border-[var(--st-border)] p-3 bg-[var(--st-bg-muted)]">
                                    <span className="text-[12px] font-semibold text-[var(--st-text)] flex items-center gap-1.5 mb-2">
                                        <Calendar className="h-3.5 w-3.5 text-[var(--st-text)]" /> Live Slot Availability Suggestion
                                    </span>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Input
                                            type="date"
                                            value={slotDate}
                                            onChange={(e) => setSlotDate(e.target.value)}
                                            className="h-9 text-[12px]"
                                        />
                                        <span className="text-[11.5px] text-[var(--st-text-secondary)]">Checks working hours (9-17)</span>
                                    </div>
                                    {availableSlots.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                                            {availableSlots.map((slot) => (
                                                <button
                                                    key={slot.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setMeetingDate(slotDate);
                                                        setMeetingTime(slot.start);
                                                    }}
                                                    className="rounded bg-[var(--st-bg)] border border-[var(--st-border)] px-2 py-1 text-[11px] font-mono hover:bg-[var(--st-text)] hover:text-white"
                                                >
                                                    {slot.start}
                                                </button>
                                            ))}
                                        </div>
                                    ) : slotDate ? (
                                        <span className="text-[11px] text-[var(--st-text-secondary)]">No free slots found.</span>
                                    ) : (
                                        <span className="text-[11px] text-[var(--st-text-secondary)]">Select a date to check slots.</span>
                                    )}
                                </div>
                            )}

                            {/* Meeting Date & Time & Duration */}
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="space-y-1">
                                    <Label htmlFor="meeting-date">Date</Label>
                                    <Input
                                        id="meeting-date"
                                        type="date"
                                        value={meetingDate}
                                        onChange={(e) => setMeetingDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="meeting-time">Time</Label>
                                    <Input
                                        id="meeting-time"
                                        type="time"
                                        value={meetingTime}
                                        onChange={(e) => setMeetingTime(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="meeting-duration">Duration (Minutes)</Label>
                                    <Input
                                        id="meeting-duration"
                                        type="number"
                                        value={duration}
                                        onChange={(e) => setDuration(Number(e.target.value))}
                                    />
                                </div>
                            </div>

                            {/* Video Conference Link */}
                            <div className="space-y-1">
                                <Label htmlFor="video-link">Video call setup</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="video-link"
                                        value={videoLink}
                                        onChange={(e) => setVideoLink(e.target.value)}
                                        placeholder="Paste custom link or auto-generate Jitsi link"
                                        className="flex-1"
                                    />
                                    <Button type="button" variant="outline" onClick={generateVideoLink}>
                                        <Video className="mr-1 h-4 w-4" /> Auto-link
                                    </Button>
                                </div>
                            </div>

                            {/* Status (Only on Edit) */}
                            {editingMeeting && (
                                <div className="space-y-1">
                                    <Label htmlFor="meeting-status">Meeting Status</Label>
                                    <select
                                        id="meeting-status"
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as any)}
                                        className="w-full rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-[13px] text-[var(--st-text)]"
                                    >
                                        <option value="scheduled">Scheduled</option>
                                        <option value="completed">Completed</option>
                                        <option value="canceled">Canceled</option>
                                    </select>
                                </div>
                            )}

                            {/* Notes */}
                            <div className="space-y-1">
                                <Label htmlFor="meeting-notes">Agenda / Notes</Label>
                                <Textarea
                                    id="meeting-notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={3}
                                    placeholder="Meeting notes or brief agenda..."
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSave} disabled={isMutating}>
                                    {isMutating ? 'Saving…' : 'Schedule'}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </EntityListShell>
    );
}
