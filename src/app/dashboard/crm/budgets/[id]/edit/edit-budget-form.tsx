'use client';

/**
 * <EditBudgetForm> — deepened edit form per CRM_PAGE_REDESIGN_PLAN §3.3.2.
 *
 * Sectioned card layout (no tabs — zoruui has no tab primitive):
 *   1. Identification — head type / head / period / scenario
 *   2. Plan & alerts — plan amount, alert at %, status, locked
 *   3. Allocation breakdown — optional line-item editor (department/
 *      period/amount) for sub-line budgets
 *   4. Ownership — owner, approver
 *   5. Supporting document — single SabFiles attachment (charter PDF,
 *      board approval, etc.)
 *   6. Notes
 *
 * The action signature is extended additively — new `allocations`
 * (JSON-encoded array) and `documentFileId` / `documentFileUrl` /
 * `documentFileName` fields are written to Mongo when present; existing
 * records without them load and save fine.
 */

import * as React from 'react';
import {
    Button,
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
    Input,
    Label,
    Switch,
    Textarea,
    useZoruToast,
} from '@/components/zoruui';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { FileText, LoaderCircle, Plus, Save, Trash2, X } from 'lucide-react';
import Link from 'next/link';

import { updateBudget } from '@/app/actions/crm-budgets.actions';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import type { EntityKey } from '@/lib/lookup-registry';

type HeadType = 'account' | 'department' | 'project';
type Scenario = 'base' | 'optimistic' | 'pessimistic';
type Status = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'closed';

interface AllocationLine {
    id: string;
    departmentId: string | null;
    departmentLabel: string;
    period: string;
    amount: number;
    note: string;
}

interface Props {
    budget: Record<string, unknown> & {
        _id?: string;
        budgetHeadType?: HeadType;
        budgetHeadId?: string;
        budgetHead?: string;
        period?: string;
        scenario?: Scenario;
        planAmount?: number;
        actual?: number;
        alertAt?: number;
        ownerId?: string;
        ownerName?: string;
        approverId?: string;
        approverName?: string;
        notes?: string;
        status?: Status;
        locked?: boolean;
        allocations?: AllocationLine[];
        documentFileId?: string;
        documentFileUrl?: string;
        documentFileName?: string;
    };
    budgetId: string;
}

const initialState = { message: null, error: null, id: undefined } as {
    message?: string | null;
    error?: string | null;
    id?: string;
};

const STATUS_OPTIONS: ReadonlyArray<{ value: Status; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'pending_approval', label: 'Pending approval' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'closed', label: 'Closed' },
];

const SCENARIO_OPTIONS: ReadonlyArray<{ value: Scenario; label: string }> = [
    { value: 'base', label: 'Base' },
    { value: 'optimistic', label: 'Optimistic' },
    { value: 'pessimistic', label: 'Pessimistic' },
];

function freshLineId(): string {
    return `alloc-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeAllocations(raw: unknown): AllocationLine[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
        .map((row) => ({
            id: typeof row.id === 'string' ? row.id : freshLineId(),
            departmentId:
                typeof row.departmentId === 'string' && row.departmentId.length > 0
                    ? row.departmentId
                    : null,
            departmentLabel:
                typeof row.departmentLabel === 'string' ? row.departmentLabel : '',
            period: typeof row.period === 'string' ? row.period : '',
            amount:
                typeof row.amount === 'number' && Number.isFinite(row.amount)
                    ? row.amount
                    : 0,
            note: typeof row.note === 'string' ? row.note : '',
        }));
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
                <Save className="h-4 w-4" strokeWidth={1.75} />
            )}
            Save changes
        </ZoruButton>
    );
}

export function EditBudgetForm({ budget, budgetId }: Props) {
    const [state, formAction] = useActionState(
        updateBudget as unknown as (
            prev: typeof initialState,
            fd: FormData,
        ) => Promise<typeof initialState>,
        initialState,
    );
    const { toast } = useZoruToast();
    const formRef = useRef<HTMLFormElement>(null);

    const [headType, setHeadType] = useState<HeadType>(
        (budget.budgetHeadType as HeadType) ?? 'account',
    );
    const [scenario, setScenario] = useState<Scenario>(
        (budget.scenario as Scenario) ?? 'base',
    );
    const [status, setStatus] = useState<Status>((budget.status as Status) ?? 'draft');
    const [locked, setLocked] = useState<boolean>(Boolean(budget.locked));
    const [allocations, setAllocations] = useState<AllocationLine[]>(() =>
        normalizeAllocations(budget.allocations),
    );
    const [planAmount, setPlanAmount] = useState<number>(
        typeof budget.planAmount === 'number' ? budget.planAmount : 0,
    );
    const [document, setDocument] = useState<SabFilePick | null>(
        budget.documentFileId
            ? {
                  id: budget.documentFileId,
                  url: budget.documentFileUrl ?? '',
                  name: budget.documentFileName ?? 'document',
              }
            : null,
    );

    const allocationsTotal = allocations.reduce(
        (sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0),
        0,
    );
    const allocationsVsPlan = planAmount - allocationsTotal;

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            window.location.href = `/dashboard/crm/budgets/${state.id ?? budgetId}`;
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, budgetId]);

    function addAllocation(): void {
        setAllocations((rows) => [
            ...rows,
            {
                id: freshLineId(),
                departmentId: null,
                departmentLabel: '',
                period: '',
                amount: 0,
                note: '',
            },
        ]);
    }

    function patchAllocation(id: string, patch: Partial<AllocationLine>): void {
        setAllocations((rows) =>
            rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
        );
    }

    function removeAllocation(id: string): void {
        setAllocations((rows) => rows.filter((row) => row.id !== id));
    }

    return (
            <form action={formAction} ref={formRef} className="space-y-6">
                <input type="hidden" name="id" value={budgetId} />
                <input
                    type="hidden"
                    name="allocations"
                    value={JSON.stringify(allocations)}
                />
                <input
                    type="hidden"
                    name="documentFileId"
                    value={document?.id ?? ''}
                />
                <input
                    type="hidden"
                    name="documentFileUrl"
                    value={document?.url ?? ''}
                />
                <input
                    type="hidden"
                    name="documentFileName"
                    value={document?.name ?? ''}
                />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="scenario" value={scenario} />
                <input type="hidden" name="budgetHeadType" value={headType} />
                <input type="hidden" name="locked" value={locked ? 'true' : 'false'} />

                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Identification</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">
                                    Head type
                                </ZoruLabel>
                                <div className="flex flex-wrap gap-1.5">
                                    {(['account', 'department', 'project'] as HeadType[]).map(
                                        (option) => (
                                            <button
                                                key={option}
                                                type="button"
                                                onClick={() => setHeadType(option)}
                                                className={`rounded-md border px-2.5 py-1 text-[12.5px] capitalize transition ${
                                                    headType === option
                                                        ? 'border-zoru-primary bg-zoru-primary/10 text-zoru-primary'
                                                        : 'border-zoru-line bg-zoru-bg text-zoru-ink hover:bg-zoru-surface-2'
                                                }`}
                                            >
                                                {option}
                                            </button>
                                        ),
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">
                                    Budget head
                                </ZoruLabel>
                                <EntityFormField
                                    entity={headType as EntityKey}
                                    name="budgetHeadId"
                                    dualWriteName="budgetHead"
                                    initialId={(budget.budgetHeadId as string) ?? null}
                                    initialLabel={(budget.budgetHead as string) ?? ''}
                                    required
                                    placeholder="Select head…"
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel
                                    htmlFor="period"
                                    className="text-[12.5px] text-zoru-ink-muted"
                                >
                                    Period
                                </ZoruLabel>
                                <ZoruInput
                                    id="period"
                                    name="period"
                                    defaultValue={budget.period ?? ''}
                                    placeholder="FY2026-Q1"
                                    required
                                    className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">
                                    Scenario
                                </ZoruLabel>
                                <div className="flex flex-wrap gap-1.5">
                                    {SCENARIO_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setScenario(opt.value)}
                                            className={`rounded-md border px-2.5 py-1 text-[12.5px] transition ${
                                                scenario === opt.value
                                                    ? 'border-zoru-primary bg-zoru-primary/10 text-zoru-primary'
                                                    : 'border-zoru-line bg-zoru-bg text-zoru-ink hover:bg-zoru-surface-2'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </ZoruCardContent>
                </ZoruCard>

                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Plan & alerts</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <ZoruLabel
                                    htmlFor="planAmount"
                                    className="text-[12.5px] text-zoru-ink-muted"
                                >
                                    Plan amount
                                </ZoruLabel>
                                <ZoruInput
                                    id="planAmount"
                                    name="planAmount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={Number.isFinite(planAmount) ? planAmount : 0}
                                    onChange={(e) =>
                                        setPlanAmount(parseFloat(e.target.value) || 0)
                                    }
                                    required
                                    className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel
                                    htmlFor="alertAt"
                                    className="text-[12.5px] text-zoru-ink-muted"
                                >
                                    Alert at (%)
                                </ZoruLabel>
                                <ZoruInput
                                    id="alertAt"
                                    name="alertAt"
                                    type="number"
                                    min="0"
                                    max="100"
                                    defaultValue={budget.alertAt ?? 80}
                                    className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">
                                    Status
                                </ZoruLabel>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as Status)}
                                    className="h-10 w-full rounded-lg border border-zoru-line bg-zoru-bg px-3 text-[13px] text-zoru-ink"
                                >
                                    {STATUS_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-surface-2/40 px-3 py-2">
                            <div className="text-[12.5px] text-zoru-ink">
                                <div className="font-medium">Lock budget</div>
                                <div className="text-zoru-ink-muted">
                                    Locked budgets can&apos;t accrue further actuals.
                                </div>
                            </div>
                            <ZoruSwitch
                                checked={locked}
                                onCheckedChange={(v) => setLocked(Boolean(v))}
                                aria-label="Lock budget"
                            />
                        </div>
                    </ZoruCardContent>
                </ZoruCard>

                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Allocation breakdown</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        {allocations.length === 0 ? (
                            <p className="text-[12.5px] text-zoru-ink-muted">
                                No sub-line allocations yet. Add one to break the plan amount
                                down by department or period.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {allocations.map((row) => (
                                    <div
                                        key={row.id}
                                        className="grid gap-2 rounded-lg border border-zoru-line bg-zoru-bg p-3 md:grid-cols-12"
                                    >
                                        <div className="md:col-span-4">
                                            <ZoruLabel className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                                                Department
                                            </ZoruLabel>
                                            <EntityFormField
                                                entity="department"
                                                name={`alloc-${row.id}-dept`}
                                                initialId={row.departmentId}
                                                initialLabel={row.departmentLabel}
                                                placeholder="Select department…"
                                                onChange={(id, hydrated) =>
                                                    patchAllocation(row.id, {
                                                        departmentId: id,
                                                        departmentLabel:
                                                            hydrated?.chip.primary ?? '',
                                                    })
                                                }
                                            />
                                        </div>
                                        <div className="md:col-span-3">
                                            <ZoruLabel className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                                                Period
                                            </ZoruLabel>
                                            <ZoruInput
                                                value={row.period}
                                                onChange={(e) =>
                                                    patchAllocation(row.id, {
                                                        period: e.target.value,
                                                    })
                                                }
                                                placeholder="Q1"
                                                className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <ZoruLabel className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                                                Amount
                                            </ZoruLabel>
                                            <ZoruInput
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={
                                                    Number.isFinite(row.amount)
                                                        ? row.amount
                                                        : 0
                                                }
                                                onChange={(e) =>
                                                    patchAllocation(row.id, {
                                                        amount:
                                                            parseFloat(e.target.value) || 0,
                                                    })
                                                }
                                                className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <ZoruLabel className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                                                Note
                                            </ZoruLabel>
                                            <ZoruInput
                                                value={row.note}
                                                onChange={(e) =>
                                                    patchAllocation(row.id, {
                                                        note: e.target.value,
                                                    })
                                                }
                                                placeholder="Optional"
                                                className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                            />
                                        </div>
                                        <div className="flex items-end justify-end md:col-span-1">
                                            <button
                                                type="button"
                                                onClick={() => removeAllocation(row.id)}
                                                className="rounded-md p-1.5 text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-danger-ink"
                                                aria-label="Remove allocation"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <ZoruButton
                                type="button"
                                variant="outline"
                                onClick={addAllocation}
                                className="h-9 gap-1"
                            >
                                <Plus className="h-4 w-4" />
                                Add allocation
                            </ZoruButton>
                            {allocations.length > 0 ? (
                                <div className="text-[12px] text-zoru-ink-muted">
                                    Allocated:{' '}
                                    <span className="font-mono tabular-nums text-zoru-ink">
                                        {allocationsTotal.toFixed(2)}
                                    </span>
                                    {' / '}
                                    Plan:{' '}
                                    <span className="font-mono tabular-nums text-zoru-ink">
                                        {planAmount.toFixed(2)}
                                    </span>
                                    {' · '}
                                    <span
                                        className={`font-mono tabular-nums ${
                                            allocationsVsPlan < 0
                                                ? 'text-zoru-danger-ink'
                                                : 'text-zoru-success-ink'
                                        }`}
                                    >
                                        {allocationsVsPlan >= 0 ? 'unallocated ' : 'over by '}
                                        {Math.abs(allocationsVsPlan).toFixed(2)}
                                    </span>
                                </div>
                            ) : null}
                        </div>
                    </ZoruCardContent>
                </ZoruCard>

                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Ownership</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">
                                    Owner
                                </ZoruLabel>
                                <EntityFormField
                                    entity="user"
                                    name="ownerId"
                                    dualWriteName="ownerName"
                                    initialId={(budget.ownerId as string) ?? null}
                                    initialLabel={(budget.ownerName as string) ?? ''}
                                    placeholder="Select owner…"
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">
                                    Approver
                                </ZoruLabel>
                                <EntityFormField
                                    entity="user"
                                    name="approverId"
                                    dualWriteName="approverName"
                                    initialId={(budget.approverId as string) ?? null}
                                    initialLabel={(budget.approverName as string) ?? ''}
                                    placeholder="Select approver…"
                                />
                            </div>
                        </div>
                    </ZoruCardContent>
                </ZoruCard>

                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Supporting document</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="flex flex-wrap items-center gap-2">
                            <SabFilePickerButton
                                accept="document"
                                onPick={(pick) => setDocument(pick)}
                            >
                                {document ? 'Replace file' : 'Attach file'}
                            </SabFilePickerButton>
                            {document ? (
                                <span className="inline-flex items-center gap-2 rounded-md border border-zoru-line bg-zoru-surface-2/40 px-2 py-1 text-[12.5px] text-zoru-ink">
                                    <FileText className="h-3.5 w-3.5 text-zoru-ink-muted" />
                                    <span className="max-w-[220px] truncate">
                                        {document.name}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setDocument(null)}
                                        aria-label="Remove document"
                                        className="rounded p-0.5 text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-danger-ink"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            ) : (
                                <span className="text-[12px] text-zoru-ink-muted">
                                    Pick from your SabFiles library or upload a new file.
                                </span>
                            )}
                        </div>
                    </ZoruCardContent>
                </ZoruCard>

                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Notes</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <ZoruTextarea
                            id="notes"
                            name="notes"
                            defaultValue={budget.notes ?? ''}
                            rows={4}
                            placeholder="Assumptions, escalation policy, or context for reviewers."
                            className="rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                        />
                    </ZoruCardContent>
                </ZoruCard>

                <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center justify-end gap-2 border-t border-zoru-line bg-zoru-bg px-2 py-3">
                    <ZoruButton variant="outline" asChild>
                        <Link href={`/dashboard/crm/budgets/${budgetId}`}>Cancel</Link>
                    </ZoruButton>
                    <SubmitButton />
                </div>
            </form>
    );
}
