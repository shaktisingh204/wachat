'use client';

import { Button, Card, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Plus,
  Save,
  Trash2 } from 'lucide-react';

// §1E.sweep: readinessOverall Select kept — form slugs (ready_now/1_year/2_3_years) differ from successionReadiness enum (ready_1_2y/ready_3_5y); resolve Rust DTO first.
// §1E.sweep: status Select kept — no successionStatus enum in catalogue.

/**
 * <SuccessionForm /> — create + edit form for HR succession plans.
 *
 * Binds to the `saveSuccessionPlan` server action via `useActionState`.
 * The successors repeater is a structured list of
 * `{ name, employeeId, readiness }` rows serialised to JSON via a
 * hidden input on submit.
 */

import { saveSuccessionPlan } from '@/app/actions/crm-succession.actions';
import type {
    CrmSuccessionCandidate,
    CrmSuccessionPlanDoc,
    CrmSuccessionReadinessOverall,
    CrmSuccessionStatus,
} from '@/lib/rust-client/crm-succession';

const BASE = '/dashboard/hrm/hr/succession';

const STATUS_OPTIONS: Array<{ value: CrmSuccessionStatus; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'approved', label: 'Approved' },
    { value: 'archived', label: 'Archived' },
];

const READINESS_OPTIONS: Array<{
    value: '' | CrmSuccessionReadinessOverall;
    label: string;
}> = [
    { value: '', label: '— Not assessed —' },
    { value: 'ready_now', label: 'Ready now' },
    { value: '1_year', label: '1 year' },
    { value: '2_3_years', label: '2–3 years' },
];

const SUCCESSOR_READINESS: Array<{ value: string; label: string }> = [
    { value: 'ready_now', label: 'Ready now' },
    { value: '1_year', label: '1 year' },
    { value: '2_3_years', label: '2–3 years' },
];

interface SuccessionFormProps {
    initialData?: CrmSuccessionPlanDoc | null;
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
            {isEditing ? 'Save changes' : 'Create plan'}
        </Button>
    );
}

export function SuccessionForm({ initialData }: SuccessionFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveSuccessionPlan, initialState);

    const [status, setStatus] = useState<CrmSuccessionStatus>(
        (initialData?.status as CrmSuccessionStatus) ?? 'draft',
    );
    const [readinessOverall, setReadinessOverall] = useState<
        '' | CrmSuccessionReadinessOverall
    >((initialData?.readinessOverall as CrmSuccessionReadinessOverall) ?? '');

    const [successors, setSuccessors] = useState<CrmSuccessionCandidate[]>(() => {
        const raw = initialData?.successors;
        if (Array.isArray(raw) && raw.length > 0) {
            return raw.map((s) => ({
                name: s.name ?? '',
                employeeId: s.employeeId,
                readiness: s.readiness,
            }));
        }
        return [{ name: '', employeeId: '', readiness: '' }];
    });

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            if (id) router.push(`${BASE}/${id}`);
            else router.push(BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    const addSuccessor = () =>
        setSuccessors((prev) => [
            ...prev,
            { name: '', employeeId: '', readiness: '' },
        ]);

    const removeSuccessor = (idx: number) =>
        setSuccessors((prev) => prev.filter((_, i) => i !== idx));

    const updateSuccessor = <K extends keyof CrmSuccessionCandidate>(
        idx: number,
        key: K,
        value: CrmSuccessionCandidate[K],
    ) =>
        setSuccessors((prev) =>
            prev.map((s, i) => (i === idx ? { ...s, [key]: value } : s)),
        );

    const cleanSuccessorsJson = JSON.stringify(
        successors
            .map((s) => ({
                name: s.name?.trim() ?? '',
                employeeId: s.employeeId?.trim() || undefined,
                readiness: s.readiness?.trim() || undefined,
            }))
            .filter((s) => s.name.length > 0),
    );

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="planId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="status" value={status} />
                <input
                    type="hidden"
                    name="readinessOverall"
                    value={readinessOverall}
                />
                <input
                    type="hidden"
                    name="successors"
                    value={cleanSuccessorsJson}
                />

                {/* Role title */}
                <div className="space-y-1.5">
                    <Label htmlFor="roleTitle">Role title *</Label>
                    <Input
                        id="roleTitle"
                        name="roleTitle"
                        required
                        placeholder="e.g. Head of Engineering"
                        defaultValue={initialData?.roleTitle ?? ''}
                    />
                </div>

                {/* Current incumbent + Critical role */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="currentIncumbent">Current incumbent</Label>
                        <Input
                            id="currentIncumbent"
                            name="currentIncumbent"
                            placeholder="Name of the person currently in role"
                            defaultValue={initialData?.currentIncumbent ?? ''}
                        />
                    </div>
                    <div className="flex items-center gap-2 self-end pb-1.5">
                        <Checkbox
                            id="criticalRole"
                            name="criticalRole"
                            defaultChecked={!!initialData?.criticalRole}
                        />
                        <Label htmlFor="criticalRole" className="cursor-pointer">
                            Critical role (business-impacting)
                        </Label>
                    </div>
                </div>

                {/* Successors repeater */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Successors</Label>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={addSuccessor}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add successor
                        </Button>
                    </div>

                    <div className="flex flex-col gap-2">
                        {successors.map((s, idx) => (
                            <div
                                key={idx}
                                className="grid grid-cols-1 gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]"
                            >
                                <Input
                                    placeholder="Successor name"
                                    value={s.name}
                                    onChange={(e) =>
                                        updateSuccessor(idx, 'name', e.target.value)
                                    }
                                />
                                <Input
                                    placeholder="Employee ID"
                                    value={s.employeeId ?? ''}
                                    onChange={(e) =>
                                        updateSuccessor(idx, 'employeeId', e.target.value)
                                    }
                                />
                                <select
                                    value={s.readiness ?? ''}
                                    onChange={(e) =>
                                        updateSuccessor(idx, 'readiness', e.target.value)
                                    }
                                    className="flex h-9 w-full rounded-md border border-[var(--st-border)] bg-transparent px-3 py-1 text-[13px] text-[var(--st-text)] shadow-sm focus:outline-none focus:ring-1 focus:ring-[var(--st-accent)]"
                                >
                                    <option value="">— Readiness —</option>
                                    {SUCCESSOR_READINESS.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeSuccessor(idx)}
                                    disabled={successors.length === 1}
                                    aria-label="Remove successor"
                                >
                                    <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Readiness + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="readiness-trigger">
                            Overall readiness
                        </Label>
                        <Select
                            value={readinessOverall || 'none'}
                            onValueChange={(v) =>
                                setReadinessOverall(
                                    v === 'none' ? '' : (v as CrmSuccessionReadinessOverall),
                                )
                            }
                        >
                            <SelectTrigger id="readiness-trigger">
                                <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                                {READINESS_OPTIONS.map((o) => (
                                    <SelectItem
                                        key={o.value || 'none'}
                                        value={o.value || 'none'}
                                    >
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="status-trigger">Status</Label>
                        <Select
                            value={status}
                            onValueChange={(v) => setStatus(v as CrmSuccessionStatus)}
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

                {/* Notes */}
                <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        rows={4}
                        placeholder="Development plan, risks, gating criteria…"
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to plans
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
