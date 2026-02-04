'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { saveExpense } from '@/app/actions/crm-expenses.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { SmartVendorSelect } from '@/components/crm/purchases/smart-vendor-select';
import { SmartClientSelect } from '@/components/crm/sales/smart-client-select';
import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

const initialState = { message: '', error: '' };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Expense
        </Button>
    );
}

export function NewExpenseForm() {
    const [state, formAction] = useActionState(saveExpense, initialState);
    const { toast } = useToast();
    const router = useRouter();

    const [expenseDate, setExpenseDate] = useState<Date | undefined>(new Date());
    const [vendorId, setVendorId] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [isBillable, setIsBillable] = useState(false);

    // Expense Categories - could be fetched from API later
    const expenseCategories = [
        "Advertising & Marketing",
        "Automobile Expense",
        "Bad Debt",
        "Bank Fees and Charges",
        "Consultant Expense",
        "Cost of Goods Sold",
        "Depreciation Expense",
        "IT and Internet Expenses",
        "Janitorial Expense",
        "Lodging",
        "Meals and Entertainment",
        "Office Supplies",
        "Payroll Expenses",
        "Rent Expense",
        "Repairs and Maintenance",
        "Salaries and Employee Wages",
        "Telephone Expense",
        "Travel Expense",
        "Utilities",
        "Other Expenses"
    ];

    if (state.message) {
        toast({ title: 'Success', description: state.message });
        router.push('/dashboard/crm/purchases/expenses');
    }

    if (state.error) {
        toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }

    return (
        <form action={formAction}>
            <input type="hidden" name="vendorId" value={vendorId} />
            <input type="hidden" name="customerId" value={customerId} />
            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Expense Information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Date *</Label>
                                <DatePicker date={expenseDate} setDate={setExpenseDate} />
                                <input type="hidden" name="expenseDate" value={expenseDate?.toISOString()} />
                            </div>
                            <div className="space-y-2">
                                <Label>Expense Account *</Label>
                                <Select name="expenseAccount" required>
                                    <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                                    <SelectContent>
                                        {expenseCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
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
                            <Label>Vendor (Optional)</Label>
                            <SmartVendorSelect
                                value={vendorId}
                                onSelect={setVendorId}
                                onVendorAdded={(newVendor) => setVendorId(newVendor._id.toString())}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea name="description" placeholder="Notes about this expense" />
                        </div>

                        <div className="space-y-2">
                            <Label>Reference #</Label>
                            <Input name="referenceNumber" placeholder="e.g. INV-001" />
                        </div>

                        <div className="border-t pt-4 mt-2 grid gap-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="isBillable" name="isBillable" checked={isBillable} onCheckedChange={(c) => setIsBillable(c === true)} />
                                <Label htmlFor="isBillable">Billable</Label>
                            </div>

                            {isBillable && (
                                <div className="space-y-2">
                                    <Label>Customer</Label>
                                    <SmartClientSelect
                                        value={customerId}
                                        onSelect={setCustomerId}
                                        onClientAdded={(newClient: any) => setCustomerId(newClient._id?.toString() || newClient.insertedId?.toString())}
                                    />
                                </div>
                            )}
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
