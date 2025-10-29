
'use client';

import { useState, useEffect, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2, ArrowLeft, Save, LoaderCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { getCrmChartOfAccounts } from '@/app/actions/crm-accounting.actions';
import { getCrmPaymentAccounts } from '@/app/actions/crm-payment-accounts.actions';
import { saveVoucherEntry, getVoucherBooks } from '@/app/actions/crm-vouchers.actions';
import type { WithId } from 'mongodb';
import type { CrmChartOfAccount, CrmVoucherBook, CrmPaymentAccount } from '@/lib/definitions';
import { getSession } from '@/app/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

type VoucherEntryItem = {
    id: string;
    accountId: string;
    remark?: string;
    currency: string;
    amount: number;
};

const LineItemsSection = ({ title, items, setItems, accounts, currency, setCurrency }: { title: string, items: VoucherEntryItem[], setItems: React.Dispatch<React.SetStateAction<VoucherEntryItem[]>>, accounts: (WithId<CrmChartOfAccount> | WithId<CrmPaymentAccount>)[], currency: string, setCurrency: (c: string) => void }) => {
    const handleAddItem = () => {
        setItems([...items, { id: uuidv4(), accountId: '', currency, amount: 0 }]);
    };

    const handleRemoveItem = (id: string) => {
        if (items.length > 1) {
            setItems(items.filter(item => item.id !== id));
        }
    };

    const handleItemChange = (id: string, field: keyof VoucherEntryItem, value: string | number) => {
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
                                        {accounts.map(acc => <SelectItem key={acc._id.toString()} value={acc._id.toString()}>{(acc as any).accountName || acc.name}</SelectItem>)}
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
    const [state, formAction] = useActionState(saveVoucherEntry, initialState);
    const router = useRouter();
    const { toast } = useToast();
    
    const [user, setUser] = useState<any>(null);
    const [allAccounts, setAllAccounts] = useState<(WithId<CrmChartOfAccount> | WithId<CrmPaymentAccount>)[]>([]);
    const [voucherBooks, setVoucherBooks] = useState<WithId<CrmVoucherBook>[]>([]);
    const [voucherDate, setVoucherDate] = useState<Date | undefined>(new Date());
    const [currency, setCurrency] = useState('INR');
    
    const [debitEntries, setDebitEntries] = useState<VoucherEntryItem[]>([{ id: uuidv4(), accountId: '', currency, amount: 0 }]);
    const [creditEntries, setCreditEntries] = useState<VoucherEntryItem[]>([{ id: uuidv4(), accountId: '', currency, amount: 0 }]);

    useEffect(() => {
        getSession().then(session => setUser(session?.user));
        Promise.all([
            getCrmChartOfAccounts(),
            getCrmPaymentAccounts(),
            getVoucherBooks()
        ]).then(([chartAccs, paymentAccs, books]) => {
            setAllAccounts([...chartAccs, ...paymentAccs]);
            setVoucherBooks(books);
        });
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/crm/accounting/vouchers');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    const totalDebits = debitEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const totalCredits = creditEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const difference = totalDebits - totalCredits;
    
    const businessProfile = user?.businessProfile;

    return (
        <form action={formAction}>
            <input type="hidden" name="debitEntries" value={JSON.stringify(debitEntries)} />
            <input type="hidden" name="creditEntries" value={JSON.stringify(creditEntries)} />
            <input type="hidden" name="date" value={voucherDate?.toISOString()} />

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
                                <h1 className="text-3xl font-bold text-primary">New Voucher Entry</h1>
                                <p className="text-muted-foreground">Record a new journal entry.</p>
                            </header>
                            
                            {!businessProfile?.name && (
                                <Alert variant="destructive" className="mb-6">
                                    <AlertCircle className="h-4 w-4"/>
                                    <AlertTitle>Business Profile Incomplete</AlertTitle>
                                    <AlertDescription>
                                        Please complete your business profile to use accounting features.
                                        <Button asChild variant="link" className="p-0 h-auto ml-2"><Link href="/dashboard/user/settings/profile">Go to Settings</Link></Button>
                                    </AlertDescription>
                                </Alert>
                            )}

                            <Separator className="my-8"/>

                            <section className="grid md:grid-cols-3 gap-4 text-sm mb-8">
                                 <div className="space-y-1">
                                    <Label htmlFor="voucherBookId">Voucher Book *</Label>
                                    <Select name="voucherBookId" required>
                                        <SelectTrigger id="voucherBookId"><SelectValue placeholder="Select a book..."/></SelectTrigger>
                                        <SelectContent>{voucherBooks.map(book => <SelectItem key={book._id.toString()} value={book._id.toString()}>{book.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="voucherNumber">Voucher Number *</Label>
                                    <Input id="voucherNumber" name="voucherNumber" required placeholder="e.g. V-001" />
                                </div>
                                <div className="space-y-1"><Label>Date *</Label><DatePicker date={voucherDate} setDate={setVoucherDate} /></div>
                                <div className="space-y-1 md:col-span-3"><Label htmlFor="note">Note</Label><Textarea id="note" name="note" placeholder="Add a Note" /></div>
                            </section>
                            
                            <LineItemsSection title="Debit Accounts" items={debitEntries} setItems={setDebitEntries} accounts={allAccounts} currency={currency} setCurrency={setCurrency} />

                             <Separator className="my-8"/>

                            <LineItemsSection title="Credit Accounts" items={creditEntries} setItems={setCreditEntries} accounts={allAccounts} currency={currency} setCurrency={setCurrency} />

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
