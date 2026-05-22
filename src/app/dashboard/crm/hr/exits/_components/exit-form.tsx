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
import { useFormStatus } from 'react-dom';
import {
  ArrowLeft,
  LoaderCircle,
  Paperclip,
  Save,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { SabFilePickerButton } from '@/components/sabfiles';

import { saveExit } from '@/app/actions/crm-exits.actions';
import type {
  CrmExitDoc,
  CrmExitStatus,
  CrmExitType,
} from '@/lib/rust-client/crm-exits';

/**
 * <ExitForm /> — canonical create + edit form for HR exits.
 *
 * Deepening (§3.3.2) over the previous stub:
 *  - Sectioned form (Employee · Workflow · Settlement · Checklist ·
 *    Documents).
 *  - Linked-entity pickers for employee + reporting manager.
 *  - Settlement calculator: gross pay + bonuses − deductions = final
 *    settlement (display-only, recalculated as the user types).
 *  - Asset / NOC / KT / FNF checklist (uses the legacy status field
 *    names so the server action contract is unchanged).
 *  - Status workflow select (open → notice → settling → cleared).
 *  - Exit documents (NDA, NOC PDF) via SabFilePickerButton — never plain
 *    URL paste.
 */

const BASE = '/dashboard/crm/hr/exits';

const TYPE_OPTIONS: { value: CrmExitType; label: string }[] = [
    { value: 'resignation', label: 'Resignation' },
    { value: 'termination', label: 'Termination' },
    { value: 'retirement', label: 'Retirement' },
    { value: 'end_of_contract', label: 'End of contract' },
    { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS: { value: CrmExitStatus; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'complete', label: 'Complete' },
    { value: 'cancelled', label: 'Cancelled' },
];

const CHECKLIST_OPTIONS: { value: string; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'done', label: 'Done' },
    { value: 'waived', label: 'Waived' },
];

interface ExitDocument {
    id: string;
    url: string;
    name: string;
    mime?: string;
    size?: number;
}

export interface ExitFormInitial extends Partial<CrmExitDoc> {
    _id?: string;
    reportingManagerId?: string;
    reportingManagerName?: string;
    grossPay?: number;
    bonuses?: number;
    deductions?: number;
    documents?: ExitDocument[];
}

export interface ExitFormProps {
    exit?: ExitFormInitial | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const INITIAL_STATE: SaveState = {};

function toDateInput(value: unknown): string {
    if (!value) return '';
    const s = typeof value === 'string' ? value : String(value);
    if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
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

export function ExitForm({ exit }: ExitFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [state, formAction] = React.useActionState(saveExit, INITIAL_STATE);
    const isEditing = !!exit?._id;

    const [employeeId, setEmployeeId] = React.useState<string>(
        exit?.employeeId ? String(exit.employeeId) : '',
    );
    const [employeeName, setEmployeeName] = React.useState<string>(
        exit?.employeeName ?? '',
    );
    const [managerId, setManagerId] = React.useState<string>(
        exit?.reportingManagerId ? String(exit.reportingManagerId) : '',
    );
    const [managerName, setManagerName] = React.useState<string>(
        exit?.reportingManagerName ?? '',
    );

    const [grossPay, setGrossPay] = React.useState<number>(
        typeof exit?.grossPay === 'number' ? exit.grossPay : 0,
    );
    const [bonuses, setBonuses] = React.useState<number>(
        typeof exit?.bonuses === 'number' ? exit.bonuses : 0,
    );
    const [deductions, setDeductions] = React.useState<number>(
        typeof exit?.deductions === 'number' ? exit.deductions : 0,
    );

    const [documents, setDocuments] = React.useState<ExitDocument[]>(
        Array.isArray(exit?.documents) ? exit!.documents! : [],
    );
    const documentsJson = React.useMemo(
        () => JSON.stringify(documents),
        [documents],
    );

    const settlement = React.useMemo(
        () =>
            (Number.isFinite(grossPay) ? grossPay : 0) +
            (Number.isFinite(bonuses) ? bonuses : 0) -
            (Number.isFinite(deductions) ? deductions : 0),
        [grossPay, bonuses, deductions],
    );

    React.useEffect(() => {
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

    const removeDocument = (id: string) =>
        setDocuments((prev) => prev.filter((d) => d.id !== id));

    return (
        <form action={formAction} className="flex w-full flex-col gap-5">
            {isEditing ? (
                <input type="hidden" name="exitId" value={exit!._id ?? ''} />
            ) : null}
            <input type="hidden" name="employeeName" value={employeeName} />
            <input
                type="hidden"
                name="reportingManagerName"
                value={managerName}
            />
            <input
                type="hidden"
                name="documents"
                value={documentsJson}
            />

            {/* ── Employee ─────────────────────────────────────────── */}
            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Employee</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="flex flex-col gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <ZoruLabel htmlFor="employeeId">
                                Employee{' '}
                                <span className="text-zoru-danger-ink">*</span>
                            </ZoruLabel>
                            <div className="mt-1.5">
                                <EntityFormField
                                    entity="employee"
                                    name="employeeId"
                                    required
                                    initialId={employeeId || null}
                                    initialLabel={employeeName}
                                    placeholder="Pick employee…"
                                    onChange={(id, hydrated) => {
                                        setEmployeeId(id ?? '');
                                        setEmployeeName(
                                            hydrated?.chip.primary ?? '',
                                        );
                                    }}
                                />
                            </div>
                        </div>
                        <div>
                            <ZoruLabel htmlFor="reportingManagerId">
                                Reporting manager
                            </ZoruLabel>
                            <div className="mt-1.5">
                                <EntityFormField
                                    entity="employee"
                                    name="reportingManagerId"
                                    initialId={managerId || null}
                                    initialLabel={managerName}
                                    placeholder="Pick manager…"
                                    onChange={(id, hydrated) => {
                                        setManagerId(id ?? '');
                                        setManagerName(
                                            hydrated?.chip.primary ?? '',
                                        );
                                    }}
                                />
                            </div>
                        </div>
                        <div>
                            <ZoruLabel htmlFor="type">Exit type</ZoruLabel>
                            <select
                                id="type"
                                name="type"
                                defaultValue={
                                    (exit?.type as CrmExitType | undefined) ??
                                    'resignation'
                                }
                                className="mt-1.5 h-10 w-full rounded-md border border-zoru-line bg-zoru-bg px-3 text-[13px] text-zoru-ink"
                            >
                                {TYPE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <ZoruLabel htmlFor="status">Status</ZoruLabel>
                            <select
                                id="status"
                                name="status"
                                defaultValue={
                                    (exit?.status as
                                        | CrmExitStatus
                                        | undefined) ?? 'open'
                                }
                                className="mt-1.5 h-10 w-full rounded-md border border-zoru-line bg-zoru-bg px-3 text-[13px] text-zoru-ink"
                            >
                                {STATUS_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            {/* ── Workflow ─────────────────────────────────────────── */}
            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Workflow</ZoruCardTitle>
                    <p className="text-[12px] text-zoru-ink-muted">
                        Track notice period and last working day.
                    </p>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <ZoruLabel htmlFor="noticeStart">
                                Notice start
                            </ZoruLabel>
                            <ZoruInput
                                id="noticeStart"
                                name="noticeStart"
                                type="date"
                                defaultValue={toDateInput(exit?.noticeStart)}
                                className="mt-1.5"
                            />
                        </div>
                        <div>
                            <ZoruLabel htmlFor="lastDay">
                                Last working day
                            </ZoruLabel>
                            <ZoruInput
                                id="lastDay"
                                name="lastDay"
                                type="date"
                                defaultValue={toDateInput(exit?.lastDay)}
                                className="mt-1.5"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <ZoruLabel htmlFor="reason">Reason</ZoruLabel>
                            <ZoruInput
                                id="reason"
                                name="reason"
                                defaultValue={exit?.reason ?? ''}
                                placeholder="Why is the employee exiting?"
                                className="mt-1.5"
                            />
                        </div>
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            {/* ── Settlement calculator ────────────────────────────── */}
            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Settlement</ZoruCardTitle>
                    <p className="text-[12px] text-zoru-ink-muted">
                        Final settlement = gross pay + bonuses − deductions.
                    </p>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div>
                            <ZoruLabel htmlFor="grossPay">Gross pay</ZoruLabel>
                            <ZoruInput
                                id="grossPay"
                                name="grossPay"
                                type="number"
                                min={0}
                                step="0.01"
                                value={Number.isFinite(grossPay) ? grossPay : 0}
                                onChange={(e) =>
                                    setGrossPay(Number(e.target.value) || 0)
                                }
                                className="mt-1.5"
                            />
                        </div>
                        <div>
                            <ZoruLabel htmlFor="bonuses">Bonuses</ZoruLabel>
                            <ZoruInput
                                id="bonuses"
                                name="bonuses"
                                type="number"
                                min={0}
                                step="0.01"
                                value={Number.isFinite(bonuses) ? bonuses : 0}
                                onChange={(e) =>
                                    setBonuses(Number(e.target.value) || 0)
                                }
                                className="mt-1.5"
                            />
                        </div>
                        <div>
                            <ZoruLabel htmlFor="deductions">
                                Deductions
                            </ZoruLabel>
                            <ZoruInput
                                id="deductions"
                                name="deductions"
                                type="number"
                                min={0}
                                step="0.01"
                                value={
                                    Number.isFinite(deductions)
                                        ? deductions
                                        : 0
                                }
                                onChange={(e) =>
                                    setDeductions(Number(e.target.value) || 0)
                                }
                                className="mt-1.5"
                            />
                        </div>
                        <div className="md:col-span-3">
                            <div className="flex items-center justify-between rounded-md border border-zoru-line bg-zoru-surface-2 px-3 py-2.5">
                                <span className="text-[12px] uppercase tracking-wide text-zoru-ink-muted">
                                    Final settlement
                                </span>
                                <ZoruBadge variant="secondary">
                                    <span className="font-mono tabular-nums text-[13px]">
                                        {settlement.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </span>
                                </ZoruBadge>
                            </div>
                        </div>
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            {/* ── Checklist ────────────────────────────────────────── */}
            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Exit checklist</ZoruCardTitle>
                    <p className="text-[12px] text-zoru-ink-muted">
                        Asset return, no-objection certificate, knowledge
                        transfer and final settlement gates.
                    </p>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        {[
                            {
                                name: 'assetReturnStatus',
                                label: 'Equipment / asset return',
                                initial: exit?.assetReturnStatus ?? 'pending',
                            },
                            {
                                name: 'nocStatus',
                                label: 'No-objection certificate',
                                initial: exit?.nocStatus ?? 'pending',
                            },
                            {
                                name: 'knowledgeTransferStatus',
                                label: 'Knowledge transfer',
                                initial:
                                    exit?.knowledgeTransferStatus ?? 'pending',
                            },
                            {
                                name: 'fnfStatus',
                                label: 'Full & final settlement',
                                initial: exit?.fnfStatus ?? 'pending',
                            },
                        ].map((row) => (
                            <div key={row.name}>
                                <ZoruLabel htmlFor={row.name}>
                                    {row.label}
                                </ZoruLabel>
                                <select
                                    id={row.name}
                                    name={row.name}
                                    defaultValue={row.initial}
                                    className="mt-1.5 h-10 w-full rounded-md border border-zoru-line bg-zoru-bg px-3 text-[13px] text-zoru-ink"
                                >
                                    {CHECKLIST_OPTIONS.map((opt) => (
                                        <option
                                            key={opt.value}
                                            value={opt.value}
                                        >
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            {/* ── Documents ────────────────────────────────────────── */}
            <ZoruCard className="p-0">
                <ZoruCardHeader className="flex flex-row items-center justify-between gap-2">
                    <div>
                        <ZoruCardTitle>Exit documents</ZoruCardTitle>
                        <p className="text-[12px] text-zoru-ink-muted">
                            NDA, NOC, settlement letters — picked from SabFiles.
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

            {/* ── Notes ────────────────────────────────────────────── */}
            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Exit interview & notes</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="flex flex-col gap-4">
                    <div>
                        <ZoruLabel htmlFor="exitInterviewNotes">
                            Exit interview notes
                        </ZoruLabel>
                        <ZoruTextarea
                            id="exitInterviewNotes"
                            name="exitInterviewNotes"
                            rows={4}
                            defaultValue={exit?.exitInterviewNotes ?? ''}
                            className="mt-1.5"
                        />
                    </div>
                    <div>
                        <ZoruLabel htmlFor="notes">Internal notes</ZoruLabel>
                        <ZoruTextarea
                            id="notes"
                            name="notes"
                            rows={3}
                            defaultValue={exit?.notes ?? ''}
                            className="mt-1.5"
                        />
                    </div>
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
                    label={isEditing ? 'Save changes' : 'Create exit'}
                />
            </div>
        </form>
    );
}

export default ExitForm;
