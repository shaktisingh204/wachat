'use client';

import { Button, Card, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * <TimeLogForm /> — create + edit form for a CRM time log.
 *
 * Manual entries take started_at / ended_at and derive duration on the
 * server when omitted. Use the list page's "Start timer" CTA for the
 * one-click flow.
 */

import { EntityFormField } from '@/components/crm/entity-form-field';

import { saveTimeLog } from '@/app/actions/crm-time-logs.actions';
import type {
    CrmTimeLogDoc,
    CrmTimeLogEntityKind,
    CrmTimeLogStatus,
} from '@/lib/rust-client/crm-time-logs';

const BASE = '/dashboard/crm/time-tracking/time-logs';

const ENTITY_KIND_OPTIONS: Array<{ value: CrmTimeLogEntityKind; label: string }> = [
    { value: 'task', label: 'Task' },
    { value: 'project_task', label: 'Project task' },
    { value: 'issue', label: 'Issue' },
    { value: 'ticket', label: 'Ticket' },
];

const STATUS_OPTIONS: Array<{ value: CrmTimeLogStatus; label: string }> = [
    { value: 'running', label: 'Running' },
    { value: 'stopped', label: 'Stopped' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'archived', label: 'Archived' },
];

import { format, parseISO } from 'date-fns';

function toDateTimeInput(value: unknown): string {
    if (!value) return '';
    try {
        const d = typeof value === 'string' ? parseISO(value) : new Date(value as any);
        if (Number.isNaN(d.getTime())) return '';
        return format(d, "yyyy-MM-dd'T'HH:mm");
    } catch {
        return '';
    }
}

interface TimeLogFormProps {
    initialData?: CrmTimeLogDoc | null;
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
            {isEditing ? 'Save changes' : 'Create entry'}
        </Button>
    );
}

export function TimeLogForm({ initialData }: TimeLogFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveTimeLog, initialState);

    const [entityKind, setEntityKind] = useState<string>(
        initialData?.entityKind ?? 'task',
    );
    const [status, setStatus] = useState<CrmTimeLogStatus>(
        initialData?.status ?? 'stopped',
    );
    const [isBillable, setIsBillable] = useState<boolean>(
        !!initialData?.isBillable,
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
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

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="logId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="entityKind" value={entityKind} />
                <input type="hidden" name="status" value={status} />
                <input
                    type="hidden"
                    name="isBillable"
                    value={isBillable ? 'true' : 'false'}
                />

                {/* Description */}
                <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        name="description"
                        rows={3}
                        placeholder="What was worked on?"
                        defaultValue={initialData?.description ?? ''}
                    />
                </div>

                {/* Started / Ended */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="startedAt">Started at</Label>
                        <Input
                            id="startedAt"
                            name="startedAt"
                            type="datetime-local"
                            defaultValue={toDateTimeInput(initialData?.startedAt)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="endedAt">Ended at</Label>
                        <Input
                            id="endedAt"
                            name="endedAt"
                            type="datetime-local"
                            defaultValue={toDateTimeInput(initialData?.endedAt)}
                        />
                    </div>
                </div>

                {/* Duration override + rate */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="durationMinutes">Duration (min)</Label>
                        <Input
                            id="durationMinutes"
                            name="durationMinutes"
                            type="number"
                            step="1"
                            defaultValue={initialData?.durationMinutes ?? ''}
                            placeholder="auto"
                        />
                        <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                            Auto-computed from start/end if blank.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="hourlyRate">Hourly rate</Label>
                        <Input
                            id="hourlyRate"
                            name="hourlyRate"
                            type="number"
                            step="0.01"
                            defaultValue={initialData?.hourlyRate ?? ''}
                            placeholder="0.00"
                        />
                    </div>
                    <div className="flex items-center gap-2 self-end pb-2">
                        <Checkbox
                            id="isBillable"
                            checked={isBillable}
                            onCheckedChange={(v) => setIsBillable(!!v)}
                        />
                        <Label htmlFor="isBillable" className="cursor-pointer">
                            Billable
                        </Label>
                    </div>
                </div>

                {/* Entity link */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="entityKind-trigger">Entity kind</Label>
                        <Select value={entityKind} onValueChange={setEntityKind}>
                            <SelectTrigger id="entityKind-trigger">
                                <SelectValue placeholder="Kind" />
                            </SelectTrigger>
                            <SelectContent>
                                {ENTITY_KIND_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Entity</Label>
                        {(() => {
                            const ENTITY_BY_KIND: Record<
                                CrmTimeLogEntityKind,
                                { entity: 'task' | 'subtask' | 'issue' | 'ticket'; label: string }
                            > = {
                                task: { entity: 'task', label: 'Pick a task…' },
                                project_task: { entity: 'subtask', label: 'Pick a subtask…' },
                                issue: { entity: 'issue', label: 'Pick an issue…' },
                                ticket: { entity: 'ticket', label: 'Pick a ticket…' },
                            };
                            const cfg = ENTITY_BY_KIND[entityKind as CrmTimeLogEntityKind];
                            return (
                                <EntityFormField
                                    key={entityKind}
                                    entity={cfg.entity}
                                    name="entityId"
                                    initialId={initialData?.entityId ?? null}
                                    placeholder={cfg.label}
                                />
                            );
                        })()}
                    </div>
                    <div className="space-y-1.5">
                        <Label>Project</Label>
                        <EntityFormField
                            entity="project"
                            name="projectId"
                            initialId={initialData?.projectId ?? null}
                            placeholder="Pick a project…"
                        />
                    </div>
                </div>

                {/* Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="status-trigger">Status</Label>
                        <Select
                            value={status}
                            onValueChange={(v) => setStatus(v as CrmTimeLogStatus)}
                        >
                            <SelectTrigger id="status-trigger">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to time logs
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
