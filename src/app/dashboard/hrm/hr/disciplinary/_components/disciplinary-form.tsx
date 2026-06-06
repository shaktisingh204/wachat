'use client';

import { Button, Card, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import {
    ArrowLeft,
  FileUp,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  X,
  } from 'lucide-react';

// 1E.sweep done — caseType/severity/status converted to <EnumFormField> using
// the dedicated `disciplinaryCaseType` / `disciplinarySeverity` /
// `disciplinaryCaseStatus` enums (slugs preserved as the form's wire contract,
// kept separate from the existing `disciplinaryType` / `disciplinaryStatus`
// enums which model the action workflow rather than the case lifecycle).
// hearing.outcome stays as a free-text input — no canonical list there yet.

/**
 * <DisciplinaryForm /> — create + edit form for HR disciplinary cases.
 *
 * Binds to the `saveDisciplinaryCase` server action via `useActionState`.
 *
 * Evidence list is sourced exclusively from SabFiles via
 * `<SabFilePickerButton>` (project SabFiles policy: no free-text URL
 * paste). Each picked file's stable URL is appended to a state array
 * and serialised through a hidden JSON-array input that
 * `parseEvidenceJson` on the server side decodes.
 *
 * Hearings is a structured repeater of
 * `{ date, outcome, notes }` rows likewise serialised to a hidden
 * JSON input that `parseHearingsJson` decodes.
 */

import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { EnumFormField } from '@/components/crm/enum-form-field';

import { saveDisciplinaryCase } from '@/app/actions/crm-disciplinary.actions';
import type {
    CrmDisciplinaryCaseDoc,
    CrmDisciplinaryHearing,
    CrmDisciplinaryStatus,
} from '@/lib/rust-client/crm-disciplinary';

const BASE = '/dashboard/hrm/hr/disciplinary';

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function filenameFromUrl(u: string): string {
    if (!u) return '';
    try {
        const path = new URL(u, 'http://x').pathname;
        return decodeURIComponent(path.split('/').pop() ?? '') || u;
    } catch {
        return u;
    }
}

interface DisciplinaryFormProps {
    initialData?: CrmDisciplinaryCaseDoc | null;
}

interface EvidenceEntry {
    url: string;
    name: string;
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
            {isEditing ? 'Save changes' : 'Create case'}
        </Button>
    );
}

export function DisciplinaryForm({ initialData }: DisciplinaryFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveDisciplinaryCase, initialState);

    const [caseType, setCaseType] = useState<string>(
        initialData?.caseType ?? 'misconduct',
    );
    const [severity, setSeverity] = useState<string>(
        initialData?.severity ?? 'minor',
    );
    const [status, setStatus] = useState<CrmDisciplinaryStatus>(
        (initialData?.status as CrmDisciplinaryStatus) ?? 'open',
    );

    const [evidence, setEvidence] = useState<EvidenceEntry[]>(() => {
        const raw = initialData?.evidence;
        if (Array.isArray(raw) && raw.length > 0) {
            return raw
                .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
                .map((url) => ({ url, name: filenameFromUrl(url) }));
        }
        return [];
    });

    const [hearings, setHearings] = useState<CrmDisciplinaryHearing[]>(() => {
        const raw = initialData?.hearings;
        if (Array.isArray(raw) && raw.length > 0) {
            return raw.map((h) => ({
                date: h.date ?? '',
                outcome: h.outcome,
                notes: h.notes,
            }));
        }
        return [];
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

    const onPickEvidence = (pick: SabFilePick) => {
        setEvidence((prev) => {
            if (prev.some((e) => e.url === pick.url)) return prev;
            return [...prev, { url: pick.url, name: pick.name }];
        });
    };

    const removeEvidence = (url: string) =>
        setEvidence((prev) => prev.filter((e) => e.url !== url));

    const addHearing = () =>
        setHearings((prev) => [
            ...prev,
            { date: '', outcome: undefined, notes: undefined },
        ]);

    const removeHearing = (idx: number) =>
        setHearings((prev) => prev.filter((_, i) => i !== idx));

    const updateHearing = <K extends keyof CrmDisciplinaryHearing>(
        idx: number,
        key: K,
        value: CrmDisciplinaryHearing[K],
    ) =>
        setHearings((prev) =>
            prev.map((h, i) => (i === idx ? { ...h, [key]: value } : h)),
        );

    const evidenceJson = JSON.stringify(evidence.map((e) => e.url));
    const hearingsJson = JSON.stringify(
        hearings
            .map((h) => ({
                date: h.date?.trim() ?? '',
                outcome: h.outcome?.trim() || undefined,
                notes: h.notes?.trim() || undefined,
            }))
            .filter((h) => h.date.length > 0),
    );

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="caseId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="caseType" value={caseType} />
                <input type="hidden" name="severity" value={severity} />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="evidence" value={evidenceJson} />
                <input type="hidden" name="hearings" value={hearingsJson} />

                {/* Employee */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="employeeName">Employee name *</Label>
                        <Input
                            id="employeeName"
                            name="employeeName"
                            required
                            placeholder="Full name"
                            defaultValue={initialData?.employeeName ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="employeeId">Employee ID</Label>
                        <Input
                            id="employeeId"
                            name="employeeId"
                            placeholder="HR employee id"
                            defaultValue={initialData?.employeeId ?? ''}
                        />
                    </div>
                </div>

                {/* Case type + Severity */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Case type</Label>
                        <EnumFormField
                            name="caseType-picker"
                            enumName="disciplinaryCaseType"
                            initialId={caseType}
                            onChange={(id) => setCaseType(id ?? 'misconduct')}
                            allowInlineCreate={false}
                            placeholder="Type"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Severity</Label>
                        <EnumFormField
                            name="severity-picker"
                            enumName="disciplinarySeverity"
                            initialId={severity}
                            onChange={(id) => setSeverity(id ?? 'minor')}
                            allowInlineCreate={false}
                            placeholder="Severity"
                        />
                    </div>
                </div>

                {/* Raised by + Incident date */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="raisedBy">Raised by</Label>
                        <Input
                            id="raisedBy"
                            name="raisedBy"
                            placeholder="Manager or HR officer"
                            defaultValue={initialData?.raisedBy ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="incidentDate">Incident date</Label>
                        <Input
                            id="incidentDate"
                            name="incidentDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.incidentDate)}
                        />
                    </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        name="description"
                        rows={4}
                        placeholder="Describe the incident or issue in detail."
                        defaultValue={initialData?.description ?? ''}
                    />
                </div>

                {/* Evidence — SabFiles only */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Evidence (from SabFiles)</Label>
                        <SabFilePickerButton
                            accept="all"
                            onPick={onPickEvidence}
                            title="Pick evidence from SabFiles"
                            variant="ghost"
                        >
                            <FileUp className="mr-1.5 h-4 w-4" />
                            Add evidence
                        </SabFilePickerButton>
                    </div>
                    {evidence.length === 0 ? (
                        <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-4 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                            No evidence attached. Use &ldquo;Add evidence&rdquo; to
                            attach files from SabFiles.
                        </div>
                    ) : (
                        <ul className="flex flex-col gap-1.5">
                            {evidence.map((e) => (
                                <li
                                    key={e.url}
                                    className="flex items-center justify-between gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2"
                                >
                                    <a
                                        href={e.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="max-w-[80%] truncate text-[12.5px] text-[var(--st-text)] underline-offset-2 hover:underline"
                                    >
                                        {e.name || e.url}
                                    </a>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeEvidence(e.url)}
                                        aria-label="Remove evidence"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Hearings repeater */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Hearings</Label>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={addHearing}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add hearing
                        </Button>
                    </div>
                    {hearings.length === 0 ? (
                        <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-4 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                            No hearings scheduled. Use &ldquo;Add hearing&rdquo; to
                            record one.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {hearings.map((h, idx) => (
                                <div
                                    key={idx}
                                    className="grid grid-cols-1 gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 sm:grid-cols-[140px_1fr_2fr_auto]"
                                >
                                    <Input
                                        type="date"
                                        value={toDateInput(h.date)}
                                        onChange={(e) =>
                                            updateHearing(idx, 'date', e.target.value)
                                        }
                                    />
                                    <Input
                                        placeholder="Outcome"
                                        value={h.outcome ?? ''}
                                        onChange={(e) =>
                                            updateHearing(idx, 'outcome', e.target.value)
                                        }
                                    />
                                    <Input
                                        placeholder="Notes"
                                        value={h.notes ?? ''}
                                        onChange={(e) =>
                                            updateHearing(idx, 'notes', e.target.value)
                                        }
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeHearing(idx)}
                                        aria-label="Remove hearing"
                                    >
                                        <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Status + Notes */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            name="status-picker"
                            enumName="disciplinaryCaseStatus"
                            initialId={status}
                            onChange={(id) =>
                                setStatus((id as CrmDisciplinaryStatus) ?? 'open')
                            }
                            allowInlineCreate={false}
                            placeholder="Status"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            name="notes"
                            rows={3}
                            defaultValue={initialData?.notes ?? ''}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to cases
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
