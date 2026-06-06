'use client';

import { Button, Card, Input, Label, Textarea, useToast, Select } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';

import { DatePicker } from '@/components/sabcrm/20ui';
import { LoaderCircle, Save } from 'lucide-react';
import { EntityPicker } from '@/components/crm/entity-picker';
import { updatePaymentReceipt } from '@/app/actions/crm-payment-receipts.actions';
import type { WithId, CrmPaymentReceipt } from '@/lib/definitions';

const initialState = { message: '', error: '' };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Update Receipt
        </Button>
    );
}

interface EditReceiptFormProps {
    receipt: WithId<CrmPaymentReceipt>;
}

export function EditReceiptForm({ receipt }: EditReceiptFormProps) {
    const [state, formAction] = useActionState(updatePaymentReceipt, initialState);
    const { toast } = useToast();
    const router = useRouter();

    const [bankAccountId, setBankAccountId] = useState<string>(
        receipt.bankAccountId ? String(receipt.bankAccountId) : ''
    );
    const [receiptDate, setReceiptDate] = useState<Date | undefined>(
        receipt.receiptDate ? new Date(receipt.receiptDate) : undefined
    );

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/crm/sales/receipts');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, router, toast]);

    return (
        <form action={formAction}>
            <input type="hidden" name="receiptId" value={String(receipt._id)} />
            <input type="hidden" name="bankAccountId" value={bankAccountId} />
            <input type="hidden" name="receiptDate" value={receiptDate?.toISOString() ?? ''} />

            <Card className="p-0">
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <Label className="text-[var(--st-text)]">Receipt No</Label>
                            <Input value={receipt.receiptNumber} disabled readOnly />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[var(--st-text)]">Receipt Date</Label>
                            <DatePicker date={receiptDate} setDate={setReceiptDate} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <Label className="text-[var(--st-text)]">Total Received</Label>
                            <Input
                                value={`${receipt.currency} ${(receipt.totalAmountReceived ?? 0).toFixed(2)}`}
                                disabled
                                readOnly
                            />
                            <p className="text-[12px] text-[var(--st-text-secondary)]">
                                Amount and settled invoices are immutable on edit. To change them, void this receipt and create a new one.
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[var(--st-text)]">Deposit To (Bank Account)</Label>
                            <EntityPicker
                                entity="bankAccount"
                                value={bankAccountId || null}
                                placeholder="Select bank account…"
                                onChange={(next) => {
                                    const id = Array.isArray(next) ? next[0] ?? '' : (next ?? '');
                                    setBankAccountId(id);
                                }}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="notes" className="text-[var(--st-text)]">Notes</Label>
                        <Textarea
                            id="notes"
                            name="notes"
                            defaultValue={receipt.notes ?? ''}
                            placeholder="e.g. Received via GPay"
                            maxLength={500}
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 p-6 pt-0">
                    <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                    <SubmitButton />
                </div>
            </Card>
        </form>
    );
}
