'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { EnumFormField } from '@/components/crm/enum-form-field';
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
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create loan'}
        </Button>
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
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="loanId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="direction" value={direction} />
                <input type="hidden" name="status" value={status} />

                {/* Row 1: Party + Direction */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="partyName">Party name *</Label>
                        <Input
                            id="partyName"
                            name="partyName"
                            required
                            placeholder="e.g. Acme Corp"
                            defaultValue={initialData?.partyName ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Direction</Label>
                        <EnumFormField
                            enumName="loanDirection"
                            initialId={direction}
                            onChange={(v) => setDirection((v ?? 'taken') as CrmLoanDirection)}
                        />
                    </div>
                </div>

                {/* Row 2: Principal + Currency */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="principal">Principal *</Label>
                        <Input
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
                        <Label htmlFor="currency">Currency</Label>
                        <Input
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
                        <Label htmlFor="interestRate">Interest rate (% p.a.)</Label>
                        <Input
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
                        <Label htmlFor="tenureMonths">Tenure (months)</Label>
                        <Input
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
                        <Label htmlFor="startDate">Start date</Label>
                        <Input
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
                        <Label htmlFor="emi">EMI</Label>
                        <Input
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
                        <Label>Status</Label>
                        <EnumFormField
                            enumName="loanStatus"
                            initialId={status}
                            onChange={(v) => setStatus((v ?? 'active') as CrmLoanStatus)}
                        />
                    </div>
                </div>

                {/* Outstanding + Paid (edit-only) */}
                {isEditing ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="outstanding">Outstanding</Label>
                            <Input
                                id="outstanding"
                                name="outstanding"
                                type="number"
                                step="0.01"
                                defaultValue={initialData?.outstanding ?? ''}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="paid">Paid</Label>
                            <Input
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
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        placeholder="Loan terms, covenants, security."
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to loans
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
