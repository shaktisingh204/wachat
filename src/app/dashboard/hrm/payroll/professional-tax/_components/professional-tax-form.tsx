'use client';

import {
  Button,
  Card,
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
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';

// 1E.sweep: status converted to <EnumFormField enumName="tdsStatus">
// (slugs match: pending/deposited/filed/archived). TODOs remaining:
// - state stays as Select over indianStates (dynamic list) — needs
//   <EntityFormField entity="state"> with India-only filter.
// - month is a <input type="month"> (native), not a dropdown.
// - employee → <EntityFormField entity="employee">.

/**
 * <ProfessionalTaxForm /> — create + edit form for monthly PT records.
 *
 * Binds to `saveProfessionalTaxRecord` via `useActionState`. The
 * `slabApplied` descriptor is *not* set client-side — it is resolved and
 * stamped by the server action from `crm_pt_slabs` at save time.
 */

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';

import {
    saveProfessionalTaxRecord,
    type CrmProfessionalTaxStatus,
} from '@/app/actions/crm-professional-tax.actions';
import { indianStates } from '@/lib/states';
import { useEntityDraft } from '@/components/crm/use-entity-draft';
import { useRef } from 'react';

const BASE = '/dashboard/hrm/payroll/professional-tax';

function currentMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

interface ProfessionalTaxFormProps {
    currentUserId?: string | null;
    initialData?: Record<string, unknown> | null;
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
            {isEditing ? 'Save changes' : 'Create PT record'}
        </Button>
    );
}

export function ProfessionalTaxForm({ initialData, currentUserId }: ProfessionalTaxFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(
        saveProfessionalTaxRecord,
        initialState,
    );

    const [stateValue, setStateValue] = useState<string>(
        (initialData?.state as string | undefined) ?? '',
    );
    const [status, setStatus] = useState<CrmProfessionalTaxStatus>(
        ((initialData?.status as CrmProfessionalTaxStatus | undefined) ??
            'pending'),
    );

const formRef = useRef<HTMLFormElement>(null);
    const [dirty, setDirty] = useState(false);

    const applyExtras = (v: any) => {
        if (v.state) setStateValue(v.state);
        if (v.status) setStatus(v.status);
    };

    const {
        draftAvailable,
        draftDismissed,
        restore: restoreDraft,
        discard: discardDraft,
        clearOnSave: clearDraftOnSave,
    } = useEntityDraft({
        entityName: 'professionalTax',
        recordId: initialData?._id ? String(initialData._id) : null,
        enabled: true,
        dirty,
        currentUserId,
        formRef,
        snapshotExtras: () => ({ state: stateValue, status }),
        applyExtras,
    });

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            setDirty(false);
            clearDraftOnSave();
            const id = state.id ?? (initialData?._id as string | undefined);
            router.push(id ? `${BASE}/${id}` : BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id, clearDraftOnSave]);

    return (
        <Card className="p-6">
            <form action={formAction} ref={formRef} onChange={() => setDirty(true)} className="flex flex-col gap-6">
                
                {draftAvailable && !draftDismissed ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-900 dark:text-amber-300">
                        <span>You have an unsaved draft from a previous session.</span>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" type="button" onClick={restoreDraft}>
                                Restore draft
                            </Button>
                            <Button size="sm" variant="ghost" type="button" onClick={discardDraft}>
                                Discard
                            </Button>
                        </div>
                    </div>
                ) : null}

                {isEditing ? (
                    <input
                        type="hidden"
                        name="recordId"
                        value={String(initialData!._id)}
                    />
                ) : null}
                <input type="hidden" name="state" value={stateValue} />
                <input type="hidden" name="status" value={status} />

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Employee *</Label>
                        <EntityFormField
                            entity="employee"
                            name="employeeId"
                            dualWriteName="employeeName"
                            required
                            initialId={(initialData?.employeeId as string | undefined) ?? null}
                            initialLabel={(initialData?.employeeName as string | undefined) ?? ''}
                            onChange={(id, hydrated) => {
                                if (hydrated?.raw?.workState) {
                                    setStateValue(hydrated.raw.workState as string);
                                }
                                setDirty(true);
                            }}
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="state-trigger">State *</Label>
                        {/* TODO 1E.sweep: dynamic list — needs <EntityFormField entity="state"> with India-only filter */}
                        <Select value={stateValue} onValueChange={(val) => { setStateValue(val); setDirty(true); }}>
                            <ZoruSelectTrigger id="state-trigger">
                                <ZoruSelectValue placeholder="Select state…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent className="max-h-60">
                                {indianStates.map((s) => (
                                    <ZoruSelectItem key={s} value={s}>
                                        {s}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="month">Month *</Label>
                        <Input
                            id="month"
                            name="month"
                            type="month"
                            required
                            defaultValue={
                                (initialData?.month as string | undefined) ??
                                currentMonth()
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            name="status-picker"
                            enumName="tdsStatus"
                            initialId={status}
                            onChange={(id) => {
                                setStatus(
                                    (id as CrmProfessionalTaxStatus) ?? 'pending',
                                );
                                setDirty(true);
                            }}
                            allowInlineCreate={false}
                            placeholder="Status"
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="grossSalary">Gross salary (₹)</Label>
                        <Input
                            id="grossSalary"
                            name="grossSalary"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            defaultValue={
                                typeof initialData?.grossSalary === 'number'
                                    ? String(initialData.grossSalary)
                                    : ''
                            }
                        />
                        <p className="text-[11.5px] text-zoru-ink-muted">
                            Used to resolve the applicable slab at save time.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="ptAmount">PT amount (₹)</Label>
                        <Input
                            id="ptAmount"
                            name="ptAmount"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            defaultValue={
                                typeof initialData?.ptAmount === 'number'
                                    ? String(initialData.ptAmount)
                                    : ''
                            }
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="challanNumber">Challan number</Label>
                        <Input
                            id="challanNumber"
                            name="challanNumber"
                            defaultValue={
                                (initialData?.challanNumber as string | undefined) ?? ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="depositDate">Deposit date</Label>
                        <Input
                            id="depositDate"
                            name="depositDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.depositDate)}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        defaultValue={
                            (initialData?.notes as string | undefined) ?? ''
                        }
                    />
                </div>

                {initialData?.slabApplied ? (
                    <div className="rounded-lg border border-dashed border-zoru-line bg-zoru-surface-2 p-3 text-[12.5px] text-zoru-ink">
                        <span className="text-zoru-ink-muted">Slab applied:</span>{' '}
                        <span className="font-mono">
                            {initialData.slabApplied as string}
                        </span>
                    </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to PT list
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
