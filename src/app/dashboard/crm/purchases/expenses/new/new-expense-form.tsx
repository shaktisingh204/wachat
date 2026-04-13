'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { saveExpense } from '@/app/actions/crm-expenses.actions';
import { ClayCard, ClayButton } from '@/components/clay';
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
        <ClayButton
            type="submit"
            variant="obsidian"
            disabled={pending}
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
            Save Expense
        </ClayButton>
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
                <ClayCard>
                    <div className="mb-4">
                        <h2 className="text-[15px] font-semibold text-clay-ink">Expense Information</h2>
                    </div>
                    <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-clay-ink">Date *</Label>
                                <DatePicker date={expenseDate} setDate={setExpenseDate} />
                                <input type="hidden" name="expenseDate" value={expenseDate?.toISOString()} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-clay-ink">Expense Account *</Label>
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
                                <Label className="text-clay-ink">Amount *</Label>
                                <Input type="number" step="0.01" name="amount" required placeholder="0.00" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-clay-ink">Currency</Label>
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
                            <Label className="text-clay-ink">Vendor (Optional)</Label>
                            <SmartVendorSelect
                                value={vendorId}
                                onSelect={setVendorId}
                                onVendorAdded={(newVendor) => setVendorId(newVendor._id.toString())}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-clay-ink">Description</Label>
                            <Textarea name="description" placeholder="Notes about this expense" />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-clay-ink">Reference #</Label>
                            <Input name="referenceNumber" placeholder="e.g. INV-001" />
                        </div>

                        <div className="border-t border-clay-border pt-4 mt-2 grid gap-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="isBillable" name="isBillable" checked={isBillable} onCheckedChange={(c) => setIsBillable(c === true)} />
                                <Label htmlFor="isBillable" className="text-clay-ink">Billable</Label>
                            </div>

                            {isBillable && (
                                <div className="space-y-2">
                                    <Label className="text-clay-ink">Customer</Label>
                                    <SmartClientSelect
                                        value={customerId}
                                        onSelect={setCustomerId}
                                        onClientAdded={(newClient: any) => setCustomerId(newClient._id?.toString() || newClient.insertedId?.toString())}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-clay-border">
                        <ClayButton type="button" variant="pill" onClick={() => router.back()}>Cancel</ClayButton>
                        <SubmitButton />
                    </div>
                </ClayCard>
            </div>
        </form>
    );
}
