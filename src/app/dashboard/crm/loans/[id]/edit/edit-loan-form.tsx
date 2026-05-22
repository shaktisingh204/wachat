'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
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
                            <Input
                                id="type"
                                name="type"
                                value={loanType}
                                onChange={(e) => setLoanType(e.target.value)}
                                className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                            />
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
                                    defaultValue={loan.principal ?? 0}
                                    className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label
                                    htmlFor="interestRate"
                                    className="text-[12.5px] text-zoru-ink-muted"
                                >
                                    Interest %
                                </Label>
                                <Input
                                    id="interestRate"
                                    name="interestRate"
                                    type="number"
                                    step="0.01"
                                    defaultValue={loan.interestRate ?? 0}
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
                                    defaultValue={loan.tenureMonths ?? 1}
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
                            <Input
                                id="status"
                                name="status"
                                defaultValue={loan.status ?? 'active'}
                                className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                            />
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
                    </div>
                    <div className="mt-6 flex justify-end border-t border-zoru-line pt-4">
                        <SubmitButton />
                    </div>
                </Card>
            </form>
        </EntityDetailShell>
    );
}
