'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { savePayout } from '@/app/actions/crm-payouts.actions';
import { ClayCard, ClayButton } from '@/components/clay';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { SmartVendorSelect } from '@/components/crm/purchases/smart-vendor-select';
import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const initialState = { message: '', error: '' };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ClayButton
            type="submit"
            variant="obsidian"
            disabled={pending}
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
            Save Payout
        </ClayButton>
    );
}

export function NewPayoutForm() {
    const [state, formAction] = useActionState(savePayout, initialState);
    const { toast } = useToast();
    const router = useRouter();

    const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
    const [vendorId, setVendorId] = useState('');

    if (state.message) {
        toast({ title: 'Success', description: state.message });
        router.push('/dashboard/crm/purchases/payouts');
    }

    if (state.error) {
        toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }

    return (
        <form action={formAction}>
            <input type="hidden" name="vendorId" value={vendorId} />
            <div className="grid gap-6">
                <ClayCard>
                    <div className="mb-4">
                        <h2 className="text-[15px] font-semibold text-foreground">Payment Details</h2>
                    </div>
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <Label className="text-foreground">Vendor *</Label>
                            <SmartVendorSelect
                                value={vendorId}
                                onSelect={setVendorId}
                                onVendorAdded={(newVendor) => setVendorId(newVendor._id.toString())}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-foreground">Payment Date *</Label>
                                <DatePicker date={paymentDate} setDate={setPaymentDate} />
                                <input type="hidden" name="paymentDate" value={paymentDate?.toISOString()} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-foreground">Payment Mode</Label>
                                <Select name="paymentMode" defaultValue="Bank Transfer">
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Cash">Cash</SelectItem>
                                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                        <SelectItem value="Cheque">Cheque</SelectItem>
                                        <SelectItem value="Credit Card">Credit Card</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-foreground">Amount *</Label>
                                <Input type="number" step="0.01" name="amount" required placeholder="0.00" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-foreground">Currency</Label>
                                <Select name="currency" defaultValue="INR">
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="INR">Indian Rupee (INR)</SelectItem>
                                        <SelectItem value="USD">US Dollar (USD)</SelectItem>
                                        <SelectItem value="EUR">Euro (EUR)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-foreground">Reference #</Label>
                            <Input name="referenceNumber" placeholder="Transaction ID, Cheque No, etc." />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-foreground">Notes</Label>
                            <Textarea name="notes" placeholder="Additional details..." />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
                        <ClayButton type="button" variant="pill" onClick={() => router.back()}>Cancel</ClayButton>
                        <SubmitButton />
                    </div>
                </ClayCard>
            </div>
        </form>
    );
}
