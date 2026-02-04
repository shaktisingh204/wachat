'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { savePayout } from '@/app/actions/crm-payouts.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Payout
        </Button>
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
                <Card>
                    <CardHeader>
                        <CardTitle>Payment Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="space-y-2">
                            <Label>Vendor *</Label>
                            <SmartVendorSelect
                                value={vendorId}
                                onSelect={setVendorId}
                                onVendorAdded={(newVendor) => setVendorId(newVendor._id.toString())}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Payment Date *</Label>
                                <DatePicker date={paymentDate} setDate={setPaymentDate} />
                                <input type="hidden" name="paymentDate" value={paymentDate?.toISOString()} />
                            </div>
                            <div className="space-y-2">
                                <Label>Payment Mode</Label>
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
                                <Label>Amount *</Label>
                                <Input type="number" step="0.01" name="amount" required placeholder="0.00" />
                            </div>
                            <div className="space-y-2">
                                <Label>Currency</Label>
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
                            <Label>Reference #</Label>
                            <Input name="referenceNumber" placeholder="Transaction ID, Cheque No, etc." />
                        </div>

                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea name="notes" placeholder="Additional details..." />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                        <SubmitButton />
                    </CardFooter>
                </Card>
            </div>
        </form>
    );
}
