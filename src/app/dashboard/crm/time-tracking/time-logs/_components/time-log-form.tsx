'use client';

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

function toDateTimeInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    // Convert to `YYYY-MM-DDTHH:MM` for `<input type="datetime-local">`.
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface TimeLogFormProps {
    initialData?: CrmTimeLogDoc | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create entry'}
        </ZoruButton>
    );
}

export function TimeLogForm({ initialData }: TimeLogFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
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
        <ZoruCard className="p-6">
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
                    <ZoruLabel htmlFor="description">Description</ZoruLabel>
                    <ZoruTextarea
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
                        <ZoruLabel htmlFor="startedAt">Started at</ZoruLabel>
                        <ZoruInput
                            id="startedAt"
                            name="startedAt"
                            type="datetime-local"
                            defaultValue={toDateTimeInput(initialData?.startedAt)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="endedAt">Ended at</ZoruLabel>
                        <ZoruInput
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
                        <ZoruLabel htmlFor="durationMinutes">Duration (min)</ZoruLabel>
                        <ZoruInput
                            id="durationMinutes"
                            name="durationMinutes"
                            type="number"
                            step="1"
                            defaultValue={initialData?.durationMinutes ?? ''}
                            placeholder="auto"
                        />
                        <p className="text-[11.5px] text-zoru-ink-muted">
                            Auto-computed from start/end if blank.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="hourlyRate">Hourly rate</ZoruLabel>
                        <ZoruInput
                            id="hourlyRate"
                            name="hourlyRate"
                            type="number"
                            step="0.01"
                            defaultValue={initialData?.hourlyRate ?? ''}
                            placeholder="0.00"
                        />
                    </div>
                    <div className="flex items-center gap-2 self-end pb-2">
                        <ZoruCheckbox
                            id="isBillable"
                            checked={isBillable}
                            onCheckedChange={(v) => setIsBillable(!!v)}
                        />
                        <ZoruLabel htmlFor="isBillable" className="cursor-pointer">
                            Billable
                        </ZoruLabel>
                    </div>
                </div>

                {/* Entity link */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="entityKind-trigger">Entity kind</ZoruLabel>
                        <ZoruSelect value={entityKind} onValueChange={setEntityKind}>
                            <ZoruSelectTrigger id="entityKind-trigger">
                                <ZoruSelectValue placeholder="Kind" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {ENTITY_KIND_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="entityId">Entity id</ZoruLabel>
                        <ZoruInput
                            id="entityId"
                            name="entityId"
                            placeholder="ObjectId"
                            defaultValue={initialData?.entityId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="projectId">Project id</ZoruLabel>
                        <ZoruInput
                            id="projectId"
                            name="projectId"
                            placeholder="Optional"
                            defaultValue={initialData?.projectId ?? ''}
                        />
                    </div>
                </div>

                {/* Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) => setStatus(v as CrmTimeLogStatus)}
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

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to time logs
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
