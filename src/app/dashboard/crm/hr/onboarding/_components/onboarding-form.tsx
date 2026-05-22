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
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  LoaderCircle,
  Paperclip,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { SabFilePickerButton } from '@/components/sabfiles';

import { saveOnboardingTemplate } from '@/app/actions/hr.actions';

/**
 * <OnboardingForm /> — deepened onboarding template editor (§3.3.2).
 *
 * Phase 1 of the template editor was a generic 2-column field grid via
 * `<HrFormPage>` that supported a single flat `tasks` array. The deepened
 * form keeps the same FormData contract (action: `saveOnboardingTemplate`,
 * key: `tasks` JSON) but layers on:
 *  - Multi-step **phases** (Pre-joining · Day 1 · Week 1 · Month 1).
 *    Each task carries a `phase` slug. Existing flat tasks are still
 *    accepted — they land in the default `pre_joining` phase on load.
 *  - Reorderable rows within a phase + per-task assignee picker.
 *  - Document upload list (offer letter, ID proof, etc.) via SabFiles.
 *  - Mentor + buddy pickers (additive on the template doc).
 *
 * Backward compat:
 *  - Records without `phase` or `documents` still load.
 *  - The saved JSON tasks include `phase` so detail views can group by phase;
 *    old consumers that only read `title/dueDays/assignee/category` work
 *    unchanged.
 */

const BASE = '/dashboard/crm/hr/onboarding';

type PhaseSlug = 'pre_joining' | 'day_1' | 'week_1' | 'month_1';

interface Phase {
    slug: PhaseSlug;
    label: string;
}

const PHASES: Phase[] = [
    { slug: 'pre_joining', label: 'Pre-joining' },
    { slug: 'day_1', label: 'Day 1' },
    { slug: 'week_1', label: 'Week 1' },
    { slug: 'month_1', label: 'Month 1' },
];

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
    { value: 'paperwork', label: 'Paperwork' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'training', label: 'Training' },
    { value: 'access', label: 'Access' },
    { value: 'intro', label: 'Introduction' },
];

interface TaskRow {
    id: string;
    title: string;
    dueDays?: number;
    assigneeId?: string;
    assigneeName?: string;
    category?: string;
    description?: string;
    phase: PhaseSlug;
}

interface DocumentRow {
    id: string;
    url: string;
    name: string;
    mime?: string;
    size?: number;
    docType?: string;
}

export interface OnboardingFormInitial {
    _id?: string;
    name?: string;
    department?: string;
    estimatedDays?: number;
    mentorId?: string;
    mentorName?: string;
    buddyId?: string;
    buddyName?: string;
    tasks?: TaskRow[];
    documents?: DocumentRow[];
}

export interface OnboardingFormProps {
    initial?: OnboardingFormInitial | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const INITIAL_STATE: SaveState = {};

function normaliseTasks(rows?: TaskRow[]): TaskRow[] {
    if (!rows || rows.length === 0) return [];
    return rows.map((r) => {
        const phase = (
            ['pre_joining', 'day_1', 'week_1', 'month_1'] as PhaseSlug[]
        ).includes(r.phase)
            ? r.phase
            : 'pre_joining';
        return {
            id: r.id ?? uuidv4(),
            title: r.title ?? '',
            dueDays:
                typeof r.dueDays === 'number'
                    ? r.dueDays
                    : r.dueDays != null
                      ? Number(r.dueDays)
                      : undefined,
            assigneeId: r.assigneeId ? String(r.assigneeId) : '',
            assigneeName: r.assigneeName ?? '',
            category: r.category ?? 'paperwork',
            description: r.description ?? '',
            phase,
        };
    });
}

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {label}
        </ZoruButton>
    );
}

export function OnboardingForm({ initial }: OnboardingFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [state, formAction] = useActionState(
        saveOnboardingTemplate,
        INITIAL_STATE,
    );
    const isEditing = !!initial?._id;

    const [tasks, setTasks] = useState<TaskRow[]>(
        normaliseTasks(initial?.tasks),
    );
    const [documents, setDocuments] = useState<DocumentRow[]>(
        Array.isArray(initial?.documents) ? initial!.documents! : [],
    );
    const [mentorId, setMentorId] = useState<string>(
        initial?.mentorId ? String(initial.mentorId) : '',
    );
    const [mentorName, setMentorName] = useState<string>(
        initial?.mentorName ?? '',
    );
    const [buddyId, setBuddyId] = useState<string>(
        initial?.buddyId ? String(initial.buddyId) : '',
    );
    const [buddyName, setBuddyName] = useState<string>(
        initial?.buddyName ?? '',
    );
    const [departmentId, setDepartmentId] = useState<string>(
        initial?.department ? String(initial.department) : '',
    );

    const tasksJson = useMemo(
        () =>
            JSON.stringify(
                tasks
                    .filter((t) => t.title.trim().length > 0)
                    .map((t) => ({
                        id: t.id,
                        title: t.title.trim(),
                        dueDays:
                            typeof t.dueDays === 'number'
                                ? t.dueDays
                                : t.dueDays
                                  ? Number(t.dueDays)
                                  : undefined,
                        assignee:
                            t.assigneeName || t.assigneeId || undefined,
                        assigneeId: t.assigneeId || undefined,
                        assigneeName: t.assigneeName || undefined,
                        category: t.category,
                        description: t.description || undefined,
                        phase: t.phase,
                    })),
            ),
        [tasks],
    );

    const documentsJson = useMemo(
        () => JSON.stringify(documents),
        [documents],
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            router.push(BASE);
            router.refresh();
        }
        if (state?.error) {
            toast({
                title: 'Could not save',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router]);

    const tasksByPhase = useMemo(() => {
        const map = new Map<PhaseSlug, TaskRow[]>();
        for (const p of PHASES) map.set(p.slug, []);
        for (const t of tasks) {
            const list = map.get(t.phase) ?? [];
            list.push(t);
            map.set(t.phase, list);
        }
        return map;
    }, [tasks]);

    const addTaskTo = (phase: PhaseSlug) =>
        setTasks((prev) => [
            ...prev,
            {
                id: uuidv4(),
                title: '',
                dueDays: undefined,
                assigneeId: '',
                assigneeName: '',
                category: 'paperwork',
                description: '',
                phase,
            },
        ]);

    const updateTask = <K extends keyof TaskRow>(
        id: string,
        key: K,
        value: TaskRow[K],
    ) =>
        setTasks((prev) =>
            prev.map((t) => (t.id === id ? { ...t, [key]: value } : t)),
        );

    const removeTask = (id: string) =>
        setTasks((prev) => prev.filter((t) => t.id !== id));

    const moveTask = (id: string, dir: -1 | 1) =>
        setTasks((prev) => {
            const idx = prev.findIndex((t) => t.id === id);
            if (idx < 0) return prev;
            const target = prev[idx];
            const sameP = prev.filter((t) => t.phase === target.phase);
            const localIdx = sameP.findIndex((t) => t.id === id);
            const nextLocal = localIdx + dir;
            if (nextLocal < 0 || nextLocal >= sameP.length) return prev;
            const partner = sameP[nextLocal];
            const partnerIdx = prev.findIndex((t) => t.id === partner.id);
            const copy = [...prev];
            [copy[idx], copy[partnerIdx]] = [copy[partnerIdx], copy[idx]];
            return copy;
        });

    const removeDocument = (id: string) =>
        setDocuments((prev) => prev.filter((d) => d.id !== id));

    return (
        <form action={formAction} className="flex w-full flex-col gap-5">
            {isEditing ? (
                <>
                    <input type="hidden" name="_id" value={initial!._id ?? ''} />
                    <input type="hidden" name="id" value={initial!._id ?? ''} />
                </>
            ) : null}
            <input type="hidden" name="tasks" value={tasksJson} />
            <input type="hidden" name="documents" value={documentsJson} />
            <input type="hidden" name="mentorName" value={mentorName} />
            <input type="hidden" name="buddyName" value={buddyName} />

            {/* ── Template basics ─────────────────────────────────── */}
            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Template basics</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <ZoruLabel htmlFor="name">
                                Name{' '}
                                <span className="text-zoru-danger-ink">*</span>
                            </ZoruLabel>
                            <ZoruInput
                                id="name"
                                name="name"
                                required
                                minLength={2}
                                defaultValue={initial?.name ?? ''}
                                className="mt-1.5"
                                placeholder="e.g. Engineering — Software Engineer"
                            />
                        </div>
                        <div>
                            <ZoruLabel htmlFor="department">
                                Department
                            </ZoruLabel>
                            <div className="mt-1.5">
                                <EntityFormField
                                    entity="department"
                                    name="department"
                                    initialId={departmentId || null}
                                    onChange={(id) =>
                                        setDepartmentId(id ?? '')
                                    }
                                    placeholder="Pick department…"
                                />
                            </div>
                        </div>
                        <div>
                            <ZoruLabel htmlFor="estimatedDays">
                                Estimated days
                            </ZoruLabel>
                            <ZoruInput
                                id="estimatedDays"
                                name="estimatedDays"
                                type="number"
                                min={0}
                                defaultValue={
                                    initial?.estimatedDays != null
                                        ? String(initial.estimatedDays)
                                        : ''
                                }
                                className="mt-1.5"
                                placeholder="e.g. 30"
                            />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 md:col-span-2">
                            <div>
                                <ZoruLabel>Mentor</ZoruLabel>
                                <div className="mt-1.5">
                                    <EntityFormField
                                        entity="employee"
                                        name="mentorId"
                                        initialId={mentorId || null}
                                        initialLabel={mentorName}
                                        placeholder="Pick mentor…"
                                        onChange={(id, hydrated) => {
                                            setMentorId(id ?? '');
                                            setMentorName(
                                                hydrated?.chip.primary ?? '',
                                            );
                                        }}
                                    />
                                </div>
                            </div>
                            <div>
                                <ZoruLabel>Buddy</ZoruLabel>
                                <div className="mt-1.5">
                                    <EntityFormField
                                        entity="employee"
                                        name="buddyId"
                                        initialId={buddyId || null}
                                        initialLabel={buddyName}
                                        placeholder="Pick buddy…"
                                        onChange={(id, hydrated) => {
                                            setBuddyId(id ?? '');
                                            setBuddyName(
                                                hydrated?.chip.primary ?? '',
                                            );
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            {/* ── Phase task lists ────────────────────────────────── */}
            {PHASES.map((phase) => (
                <ZoruCard key={phase.slug} className="p-0">
                    <ZoruCardHeader className="flex flex-row items-center justify-between gap-2">
                        <div>
                            <ZoruCardTitle>
                                {phase.label}
                                <ZoruBadge
                                    variant="secondary"
                                    className="ml-2"
                                >
                                    {tasksByPhase.get(phase.slug)?.length ?? 0}
                                </ZoruBadge>
                            </ZoruCardTitle>
                        </div>
                        <ZoruButton
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addTaskTo(phase.slug)}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add task
                        </ZoruButton>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        {(tasksByPhase.get(phase.slug) ?? []).length === 0 ? (
                            <p className="rounded-md border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-3 text-center text-[12px] text-zoru-ink-muted">
                                No tasks in {phase.label.toLowerCase()} yet.
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {(tasksByPhase.get(phase.slug) ?? []).map(
                                    (row, idx, all) => (
                                        <li
                                            key={row.id}
                                            className="rounded-md border border-zoru-line bg-zoru-surface-2 p-2.5"
                                        >
                                            <div className="grid items-end gap-2 sm:grid-cols-[1fr_180px_120px_140px_auto]">
                                                <ZoruInput
                                                    placeholder={`Task ${idx + 1}`}
                                                    value={row.title}
                                                    onChange={(e) =>
                                                        updateTask(
                                                            row.id,
                                                            'title',
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="h-9"
                                                />
                                                <EntityFormField
                                                    entity="employee"
                                                    name={`__taskAssignee-${row.id}`}
                                                    initialId={row.assigneeId}
                                                    initialLabel={
                                                        row.assigneeName
                                                    }
                                                    placeholder="Owner"
                                                    onChange={(id, hydrated) => {
                                                        updateTask(
                                                            row.id,
                                                            'assigneeId',
                                                            id ?? '',
                                                        );
                                                        updateTask(
                                                            row.id,
                                                            'assigneeName',
                                                            hydrated?.chip
                                                                .primary ?? '',
                                                        );
                                                    }}
                                                />
                                                <ZoruInput
                                                    type="number"
                                                    min={0}
                                                    placeholder="Due days"
                                                    value={
                                                        row.dueDays ?? ''
                                                    }
                                                    onChange={(e) =>
                                                        updateTask(
                                                            row.id,
                                                            'dueDays',
                                                            e.target.value
                                                                ? Number(
                                                                      e.target
                                                                          .value,
                                                                  )
                                                                : undefined,
                                                        )
                                                    }
                                                    className="h-9"
                                                />
                                                <select
                                                    value={
                                                        row.category ??
                                                        'paperwork'
                                                    }
                                                    onChange={(e) =>
                                                        updateTask(
                                                            row.id,
                                                            'category',
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="h-9 w-full rounded-md border border-zoru-line bg-zoru-bg px-2 text-[13px] text-zoru-ink"
                                                >
                                                    {CATEGORY_OPTIONS.map(
                                                        (opt) => (
                                                            <option
                                                                key={opt.value}
                                                                value={opt.value}
                                                            >
                                                                {opt.label}
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                                <div className="flex items-center justify-end gap-1">
                                                    <ZoruButton
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label="Move up"
                                                        disabled={idx === 0}
                                                        onClick={() =>
                                                            moveTask(row.id, -1)
                                                        }
                                                    >
                                                        <ArrowUp className="h-3.5 w-3.5" />
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label="Move down"
                                                        disabled={
                                                            idx === all.length - 1
                                                        }
                                                        onClick={() =>
                                                            moveTask(row.id, 1)
                                                        }
                                                    >
                                                        <ArrowDown className="h-3.5 w-3.5" />
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label="Remove task"
                                                        onClick={() =>
                                                            removeTask(row.id)
                                                        }
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                                                    </ZoruButton>
                                                </div>
                                            </div>
                                            <div className="mt-2">
                                                <ZoruTextarea
                                                    rows={2}
                                                    value={
                                                        row.description ?? ''
                                                    }
                                                    onChange={(e) =>
                                                        updateTask(
                                                            row.id,
                                                            'description',
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="Description / acceptance criteria…"
                                                />
                                            </div>
                                        </li>
                                    ),
                                )}
                            </ul>
                        )}
                    </ZoruCardContent>
                </ZoruCard>
            ))}

            {/* ── Documents ────────────────────────────────────────── */}
            <ZoruCard className="p-0">
                <ZoruCardHeader className="flex flex-row items-center justify-between gap-2">
                    <div>
                        <ZoruCardTitle>Onboarding documents</ZoruCardTitle>
                        <p className="text-[12px] text-zoru-ink-muted">
                            Offer letter, ID proof, address proof, etc. —
                            picked from SabFiles.
                        </p>
                    </div>
                    <SabFilePickerButton
                        onPick={(pick) => {
                            setDocuments((prev) =>
                                prev.some((d) => d.id === pick.id)
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
                        <Paperclip className="mr-1.5 h-3.5 w-3.5" /> Add document
                    </SabFilePickerButton>
                </ZoruCardHeader>
                <ZoruCardContent>
                    {documents.length === 0 ? (
                        <p className="rounded-md border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-3 text-center text-[12px] text-zoru-ink-muted">
                            No documents attached yet.
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-1.5">
                            {documents.map((d) => (
                                <li
                                    key={d.id}
                                    className="flex items-center justify-between gap-2 rounded-md border border-zoru-line px-2.5 py-1.5 text-[12.5px]"
                                >
                                    <span className="truncate text-zoru-ink">
                                        {d.name}
                                    </span>
                                    <ZoruButton
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeDocument(d.id)}
                                        aria-label={`Remove ${d.name}`}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </ZoruButton>
                                </li>
                            ))}
                        </ul>
                    )}
                </ZoruCardContent>
            </ZoruCard>

            {state?.error ? (
                <p
                    role="alert"
                    className="text-sm text-zoru-danger-ink"
                >
                    {state.error}
                </p>
            ) : null}

            {/* ── Sticky footer ────────────────────────────────────── */}
            <div className="sticky bottom-0 -mx-4 -mb-4 mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-zoru-line bg-zoru-bg px-4 py-3 md:-mx-6 md:px-6">
                <ZoruButton variant="ghost" asChild>
                    <Link href={BASE}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
                    </Link>
                </ZoruButton>
                <SubmitButton
                    label={
                        isEditing ? 'Save changes' : 'Create template'
                    }
                />
            </div>
        </form>
    );
}

export default OnboardingForm;
