'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Save } from 'lucide-react';

import { updateLoan } from '@/app/actions/crm-loans.actions';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import type { EntityKey } from '@/lib/lookup-registry';

function borrowerEntityForType(type: string): EntityKey {
    if (type === 'employee_advance') return 'employee';
    if (type === 'vendor_advance') return 'vendor';
    return 'client';
}

interface Props {
    loan: any;
    loanId: string;
}

const initialState = { message: null, error: null, id: undefined } as any;

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
                <Save className="h-4 w-4" strokeWidth={1.75} />
            )}
            Save Changes
        </Button>
    );
}

function toInputDate(value: unknown): string {
    if (!value) return '';
    try {
        const d = new Date(value as string);
        if (Number.isNaN(d.getTime())) return '';
        return d.toISOString().slice(0, 10);
    } catch {
        return '';
    }
}

export function EditLoanForm({ loan, loanId }: Props) {
    const [state, formAction] = useActionState(updateLoan as any, initialState);
    const { toast } = useZoruToast();
    const formRef = useRef<HTMLFormElement>(null);
    
    const [loanType, setLoanType] = useState<string>(loan?.type ?? 'customer_loan');
    const [principal, setPrincipal] = useState<number>(Number(loan?.principal) || 0);
    const [interestRate, setInterestRate] = useState<number>(Number(loan?.interestRate) || 0);
    const [tenureMonths, setTenureMonths] = useState<number>(Number(loan?.tenureMonths) || 1);

    // Amortization calculation
    let monthlyPayment = 0;
    if (principal > 0 && tenureMonths > 0) {
        if (interestRate > 0) {
            const r = (interestRate / 100) / 12;
            monthlyPayment = principal * (r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
        } else {
            monthlyPayment = principal / tenureMonths;
        }
    }


    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Success!', description: state.message });
            window.location.href = `/dashboard/crm/loans/${state.id ?? loanId}`;
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, loanId]);

    return (
        <EntityDetailShell
            eyebrow="LOAN"
            title="Edit Loan"
            back={{ href: `/dashboard/crm/loans/${loanId}`, label: 'Back to loan' }}
        >
            <form action={formAction} ref={formRef}>
                <input type="hidden" name="id" value={loanId} />
                <Card className="p-6">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="type" className="text-[12.5px] text-zoru-ink-muted">
                                Type
                            </Label>
                            <Select name="type" value={loanType} onValueChange={setLoanType}>
                                <SelectTrigger className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="customer_loan">Customer Loan</SelectItem>
                                    <SelectItem value="employee_advance">Employee Advance</SelectItem>
                                    <SelectItem value="vendor_advance">Vendor Advance</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[12.5px] text-zoru-ink-muted">
                                Borrower
                            </Label>
                            <EntityFormField
                                entity={borrowerEntityForType(loanType)}
                                name="borrowerId"
                                dualWriteName="borrowerName"
                                initialId={loan.borrowerId ?? null}
                                initialLabel={loan.borrowerName ?? ''}
                                required
                                placeholder="Select borrower…"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="principal"
                                    className="text-[12.5px] text-zoru-ink-muted"
                                >
                                    Principal
                                </Label>
                                <Input
                                    id="principal"
                                    name="principal"
                                    type="number"
                                    step="0.01"
                                    required
                                    value={principal}
                                    onChange={(e) => setPrincipal(e.target.value === '' ? 0 : Number(e.target.value))}
                                    className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label
                                    htmlFor="interestRate"
                                    className="text-[12.5px] text-zoru-ink-muted"
                                >
                                    Interest % (Annual)
                                </Label>
                                <Input
                                    id="interestRate"
                                    name="interestRate"
                                    type="number"
                                    step="0.01"
                                    value={interestRate}
                                    onChange={(e) => setInterestRate(e.target.value === '' ? 0 : Number(e.target.value))}
                                    className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="tenureMonths"
                                    className="text-[12.5px] text-zoru-ink-muted"
                                >
                                    Tenure (months)
                                </Label>
                                <Input
                                    id="tenureMonths"
                                    name="tenureMonths"
                                    type="number"
                                    value={tenureMonths}
                                    onChange={(e) => setTenureMonths(e.target.value === '' ? 0 : Number(e.target.value))}
                                    className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label
                                    htmlFor="startDate"
                                    className="text-[12.5px] text-zoru-ink-muted"
                                >
                                    Start date
                                </Label>
                                <Input
                                    id="startDate"
                                    name="startDate"
                                    type="date"
                                    defaultValue={toInputDate(loan.startDate)}
                                    className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label
                                htmlFor="status"
                                className="text-[12.5px] text-zoru-ink-muted"
                            >
                                Status
                            </Label>
                            <Select name="status" defaultValue={loan.status ?? 'active'}>
                                <SelectTrigger className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="defaulted">Defaulted</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label
                                htmlFor="notes"
                                className="text-[12.5px] text-zoru-ink-muted"
                            >
                                Notes
                            </Label>
                            <Textarea
                                id="notes"
                                name="notes"
                                defaultValue={loan.notes ?? ''}
                                className="min-h-24 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                            />
                        </div>

                        {/* Schedule Preview */}
                        <div className="rounded-lg border border-zoru-line bg-zoru-bg-muted p-4 mt-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-[13px] font-medium text-zoru-ink">Estimated Monthly Repayment</h4>
                                    <p className="text-[12px] text-zoru-ink-muted mt-0.5">Calculated using amortized schedule</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-semibold text-zoru-ink">
                                        ${monthlyPayment.toFixed(2)}
                                    </div>
                                    <div className="text-[12px] text-zoru-ink-muted mt-0.5">
                                        Total: ${(monthlyPayment * tenureMonths).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end border-t border-zoru-line pt-4">
                        <SubmitButton />
                    </div>
                </Card>
            </form>
        </EntityDetailShell>
    );
}
