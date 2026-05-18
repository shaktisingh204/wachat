'use client';

import {
  ZoruButton,
  ZoruCard,
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
  useMemo,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * <LoanForm /> — create + edit form for CRM loans.
 *
 * Binds to the `saveLoan` server action via `useActionState`. Computes a
 * live EMI preview from `principal × interestRate × tenureMonths`; the
 * server-side actions file recomputes via `computeEmi()` so the value
 * always reflects the canonical formula.
 */

import { saveLoan } from '@/app/actions/crm-loans.actions';
import type {
    CrmLoanDirection,
    CrmLoanDoc,
    CrmLoanStatus,
} from '@/lib/rust-client/crm-loans';

const BASE = '/dashboard/crm/loans';

const DIRECTION_OPTIONS: Array<{ value: CrmLoanDirection; label: string }> = [
    { value: 'taken', label: 'Taken (we owe the party)' },
    { value: 'given', label: 'Given (party owes us)' },
];

const STATUS_OPTIONS: Array<{ value: CrmLoanStatus; label: string }> = [
    { value: 'active', label: 'Active' },
    { value: 'closed', label: 'Closed' },
    { value: 'defaulted', label: 'Defaulted' },
    { value: 'archived', label: 'Archived' },
];

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

/** Identical formula to the server-side `computeEmi` helper. */
function previewEmi(
    principal: number,
    annualRate: number,
    months: number,
): number {
    if (!Number.isFinite(principal) || principal <= 0 || months <= 0) return 0;
    if (annualRate <= 0) return Math.round((principal / months) * 100) / 100;
    const r = annualRate / 1200;
    const emi = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
    return Math.round(emi * 100) / 100;
}

interface LoanFormProps {
    initialData?: CrmLoanDoc | null;
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
            {isEditing ? 'Save changes' : 'Create loan'}
        </ZoruButton>
    );
}

export function LoanForm({ initialData }: LoanFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveLoan, initialState);

    const [direction, setDirection] = useState<CrmLoanDirection>(
        (initialData?.direction as CrmLoanDirection) ?? 'taken',
    );
    const [status, setStatus] = useState<CrmLoanStatus>(
        (initialData?.status as CrmLoanStatus) ?? 'active',
    );

    const [principal, setPrincipal] = useState<string>(
        initialData?.principal != null ? String(initialData.principal) : '',
    );
    const [interestRate, setInterestRate] = useState<string>(
        initialData?.interestRate != null ? String(initialData.interestRate) : '',
    );
    const [tenureMonths, setTenureMonths] = useState<string>(
        initialData?.tenureMonths != null ? String(initialData.tenureMonths) : '',
    );

    const emiPreview = useMemo(
        () =>
            previewEmi(
                Number(principal) || 0,
                Number(interestRate) || 0,
                Number(tenureMonths) || 0,
            ),
        [principal, interestRate, tenureMonths],
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
                    <input type="hidden" name="loanId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="direction" value={direction} />
                <input type="hidden" name="status" value={status} />

                {/* Row 1: Party + Direction */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="partyName">Party name *</ZoruLabel>
                        <ZoruInput
                            id="partyName"
                            name="partyName"
                            required
                            placeholder="e.g. Acme Corp"
                            defaultValue={initialData?.partyName ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="direction-trigger">Direction</ZoruLabel>
                        <ZoruSelect
                            value={direction}
                            onValueChange={(v) => setDirection(v as CrmLoanDirection)}
                        >
                            <ZoruSelectTrigger id="direction-trigger">
                                <ZoruSelectValue placeholder="Pick a direction…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {DIRECTION_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                </div>

                {/* Row 2: Principal + Currency */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="principal">Principal *</ZoruLabel>
                        <ZoruInput
                            id="principal"
                            name="principal"
                            type="number"
                            step="0.01"
                            required
                            value={principal}
                            onChange={(e) => setPrincipal(e.target.value)}
                            placeholder="100000"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="currency">Currency</ZoruLabel>
                        <ZoruInput
                            id="currency"
                            name="currency"
                            placeholder="INR"
                            defaultValue={initialData?.currency ?? 'INR'}
                        />
                    </div>
                </div>

                {/* Row 3: Interest + Tenure + Start date */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="interestRate">Interest rate (% p.a.)</ZoruLabel>
                        <ZoruInput
                            id="interestRate"
                            name="interestRate"
                            type="number"
                            step="0.01"
                            value={interestRate}
                            onChange={(e) => setInterestRate(e.target.value)}
                            placeholder="12"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="tenureMonths">Tenure (months)</ZoruLabel>
                        <ZoruInput
                            id="tenureMonths"
                            name="tenureMonths"
                            type="number"
                            step="1"
                            value={tenureMonths}
                            onChange={(e) => setTenureMonths(e.target.value)}
                            placeholder="12"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="startDate">Start date</ZoruLabel>
                        <ZoruInput
                            id="startDate"
                            name="startDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.startDate)}
                        />
                    </div>
                </div>

                {/* EMI preview + override */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="emi">EMI</ZoruLabel>
                        <ZoruInput
                            id="emi"
                            name="emi"
                            type="number"
                            step="0.01"
                            placeholder={emiPreview > 0 ? emiPreview.toFixed(2) : 'auto'}
                            defaultValue={initialData?.emi ?? ''}
                        />
                        <p className="text-[11.5px] text-zoru-ink-muted">
                            Auto-computed:{' '}
                            <span className="font-mono">{emiPreview.toFixed(2)}</span>.
                            Leave blank to use the computed value.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) => setStatus(v as CrmLoanStatus)}
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

                {/* Outstanding + Paid (edit-only) */}
                {isEditing ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="outstanding">Outstanding</ZoruLabel>
                            <ZoruInput
                                id="outstanding"
                                name="outstanding"
                                type="number"
                                step="0.01"
                                defaultValue={initialData?.outstanding ?? ''}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="paid">Paid</ZoruLabel>
                            <ZoruInput
                                id="paid"
                                name="paid"
                                type="number"
                                step="0.01"
                                defaultValue={initialData?.paid ?? ''}
                            />
                        </div>
                    </div>
                ) : null}

                {/* Notes */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                    <ZoruTextarea
                        id="notes"
                        name="notes"
                        rows={3}
                        placeholder="Loan terms, covenants, security."
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to loans
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
