
'use client';

import { useState, useEffect, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2, ArrowLeft, Save, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { getCrmChartOfAccounts } from '@/app/actions/crm-accounting.actions';
import type { WithId } from 'mongodb';
import type { CrmChartOfAccount } from '@/lib/definitions';

const initialState = { message: null, error: null };

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Submit
    </Button>
  );
}

type VoucherEntry = {
    id: string;
    accountId: string;
    remark?: string;
    currency: string;
    amount: number;
};

const LineItemsSection = ({ title, items, setItems, accounts, currency, setCurrency }: { title: string, items: VoucherEntry[], setItems: React.Dispatch<React.SetStateAction<VoucherEntry[]>>, accounts: WithId<CrmChartOfAccount>[], currency: string, setCurrency: (c: string) => void }) => {
    const handleAddItem = () => {
        setItems([...items, { id: uuidv4(), accountId: '', currency, amount: 0 }]);
    };

    const handleRemoveItem = (id: string) => {
        if (items.length > 1) {
            setItems(items.filter(item => item.id !== id));
        }
    };

    const handleItemChange = (id: string, field: keyof VoucherEntry, value: string | number) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const totalAmount = items.reduce((sum, item) => sum + Number(item.amount), 0);

    return (
        <section>
            <div className="flex justify-between items-baseline mb-2">
                 <h3 className="font-semibold text-lg">{title}</h3>
                 <p className="text-sm font-medium">Total: {new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalAmount)}</p>
            </div>
            <div className="space-y-3">
                {items.map((item, index) => (
                    <div key={item.id} className="p-3 border rounded-lg bg-muted/50 space-y-3">
                        <div className="flex justify-between items-center">
                            <Label>Item {index + 1}</Label>
                            {items.length > 1 && (
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveItem(item.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            )}
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs">Account *</Label>
                                <Select value={item.accountId} onValueChange={(val) => handleItemChange(item.id, 'accountId', val)} required>
                                    <SelectTrigger><SelectValue placeholder="Search from an Account..." /></SelectTrigger>
                                    <SelectContent>
                                        {accounts.map(acc => <SelectItem key={acc._id.toString()} value={acc._id.toString()}>{acc.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-1">
                                <Label className="text-xs">Remark</Label>
                                <Input placeholder="Add Remark" value={item.remark || ''} onChange={e => handleItemChange(item.id, 'remark', e.target.value)} />
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs">Currency *</Label>
                                <Select value={item.currency} onValueChange={(val) => handleItemChange(item.id, 'currency', val)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="INR">Indian Rupee (INR, ₹)</SelectItem>
                                        <SelectItem value="USD">US Dollar (USD, $)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-1">
                                <Label className="text-xs">Amount *</Label>
                                <Input type="number" value={item.amount} onChange={e => handleItemChange(item.id, 'amount', Number(e.target.value))} required />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
             <Button type="button" variant="outline" size="sm" className="mt-3" onClick={handleAddItem}><PlusCircle className="mr-2 h-4 w-4"/>Add Line Item</Button>
        </section>
    );
}

export default function NewVoucherPage() {
    const [accounts, setAccounts] = useState<WithId<CrmChartOfAccount>[]>([]);
    const [voucherDate, setVoucherDate] = useState<Date | undefined>(new Date());
    const [currency, setCurrency] = useState('INR');
    
    const [debitEntries, setDebitEntries] = useState<VoucherEntry[]>([{ id: uuidv4(), accountId: '', currency, amount: 0 }]);
    const [creditEntries, setCreditEntries] = useState<VoucherEntry[]>([{ id: uuidv4(), accountId: '', currency, amount: 0 }]);

    useEffect(() => {
        getCrmChartOfAccounts().then(setAccounts);
    }, []);

    const totalDebits = debitEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const totalCredits = creditEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const difference = totalDebits - totalCredits;

    return (
        <form>
             <div className="bg-muted/30">
                <div className="container mx-auto p-4 md:p-8">
                     <header className="flex justify-between items-center mb-6">
                         <div>
                            <Button variant="ghost" asChild className="-ml-4">
                                <Link href="/dashboard/crm/accounting/vouchers"><ArrowLeft className="mr-2 h-4 w-4" />Back to Voucher Books</Link>
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                             <SaveButton disabled={difference !== 0} />
                        </div>
                     </header>
                    <Card className="max-w-4xl mx-auto shadow-2xl p-4 sm:p-8 md:p-12">
                        <CardContent className="p-0">
                            <header className="text-center mb-8">
                                <h1 className="text-3xl font-bold text-primary">Receipt Voucher Book Voucher Entry</h1>
                                <p className="text-muted-foreground">Receipt</p>
                            </header>
                            
                            <Separator className="my-8"/>

                            <section className="grid md:grid-cols-3 gap-4 text-sm mb-8">
                                <div className="space-y-1"><Label htmlFor="fy">Select FY *</Label>
                                    <Select defaultValue="fy2526" name="financialYear">
                                        <SelectTrigger id="fy"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="fy2526">FY 2025-2026</SelectItem>
                                            <SelectItem value="fy2425">FY 2024-2025</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1"><Label htmlFor="date">Date *</Label><DatePicker id="date" date={voucherDate} setDate={setVoucherDate} /></div>
                                <div className="space-y-1 md:col-span-3"><Label htmlFor="note">Note</Label><Textarea id="note" name="note" placeholder="Add a Note" /></div>
                            </section>
                            
                            <LineItemsSection title="Debit Accounts" items={debitEntries} setItems={setDebitEntries} accounts={accounts} currency={currency} setCurrency={setCurrency} />

                             <Separator className="my-8"/>

                            <LineItemsSection title="Credit Accounts" items={creditEntries} setItems={setCreditEntries} accounts={accounts} currency={currency} setCurrency={setCurrency} />

                             <Separator className="my-8"/>
                            
                             <div className="flex justify-end font-semibold text-lg p-4">
                                <div className="w-full max-w-sm space-y-2">
                                     <div className="flex justify-between"><span>Total Debit</span><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalDebits)}</span></div>
                                     <div className="flex justify-between"><span>Total Credit</span><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalCredits)}</span></div>
                                     {difference !== 0 && (
                                        <div className="flex justify-between text-destructive pt-2 border-t"><span>Difference</span><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(Math.abs(difference))}</span></div>
                                     )}
                                </div>
                             </div>

                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    );
}

