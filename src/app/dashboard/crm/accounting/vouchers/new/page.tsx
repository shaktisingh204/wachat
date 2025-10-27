
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

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Voucher
    </Button>
  );
}

type VoucherEntry = {
    id: string;
    accountId: string;
    debit: number;
    credit: number;
};

export default function NewVoucherPage() {
    // const [state, formAction] = useActionState(saveVoucher, initialState);
    const router = useRouter();
    const { toast } = useToast();
    
    const [accounts, setAccounts] = useState<WithId<CrmChartOfAccount>[]>([]);
    const [voucherDate, setVoucherDate] = useState<Date | undefined>(new Date());
    const [entries, setEntries] = useState<VoucherEntry[]>([
        { id: uuidv4(), accountId: '', debit: 0, credit: 0 },
        { id: uuidv4(), accountId: '', debit: 0, credit: 0 },
    ]);
    
    useEffect(() => {
        getCrmChartOfAccounts().then(setAccounts);
    }, []);

    const totalDebits = entries.reduce((sum, entry) => sum + Number(entry.debit), 0);
    const totalCredits = entries.reduce((sum, entry) => sum + Number(entry.credit), 0);
    const difference = totalDebits - totalCredits;

    const handleAddEntry = () => {
        setEntries([...entries, { id: uuidv4(), accountId: '', debit: 0, credit: 0 }]);
    };

    const handleRemoveEntry = (id: string) => {
        setEntries(entries.filter(e => e.id !== id));
    };

    const handleEntryChange = (id: string, field: keyof VoucherEntry, value: string | number) => {
        setEntries(entries.map(e => e.id === id ? { ...e, [field]: value } : e));
    };

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
                            <Button variant="outline" type="button">Save As Draft</Button>
                             <SaveButton />
                        </div>
                     </header>
                    <Card className="max-w-4xl mx-auto shadow-2xl p-4 sm:p-8 md:p-12">
                        <CardContent className="p-0">
                            <header className="mb-8">
                                <h1 className="text-3xl font-bold text-primary">New Voucher Entry</h1>
                            </header>
                            
                            <Separator className="my-8"/>

                            <section className="grid md:grid-cols-3 gap-4 text-sm mb-8">
                                <div className="space-y-1"><Label className="text-xs">Voucher Type</Label><Input value="Journal" disabled /></div>
                                <div className="space-y-1"><Label className="text-xs">Voucher No.</Label><Input name="voucherNumber" defaultValue="JOU-00001" className="h-8" maxLength={50} /></div>
                                <div className="space-y-1"><Label className="text-xs">Date *</Label><DatePicker date={voucherDate} setDate={setVoucherDate} /></div>
                            </section>

                            <section>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted">
                                            <tr className="border-b">
                                                <th className="p-3 text-left font-medium">Account</th>
                                                <th className="p-3 text-right font-medium">Debit</th>
                                                <th className="p-3 text-right font-medium">Credit</th>
                                                <th className="p-3 w-12"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {entries.map((entry, index) => (
                                                <tr key={entry.id} className="border-b">
                                                    <td className="p-2">
                                                        <Select value={entry.accountId} onValueChange={(val) => handleEntryChange(entry.id, 'accountId', val)}>
                                                            <SelectTrigger><SelectValue placeholder="Select Account..."/></SelectTrigger>
                                                            <SelectContent>
                                                                {accounts.map(acc => <SelectItem key={acc._id.toString()} value={acc._id.toString()}>{acc.name}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </td>
                                                    <td className="p-2"><Input type="number" step="0.01" className="w-32 text-right" value={entry.debit} onChange={(e) => handleEntryChange(entry.id, 'debit', e.target.value)} /></td>
                                                    <td className="p-2"><Input type="number" step="0.01" className="w-32 text-right" value={entry.credit} onChange={(e) => handleEntryChange(entry.id, 'credit', e.target.value)} /></td>
                                                    <td className="p-2"><Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveEntry(entry.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t font-bold">
                                                <td className="p-3 text-right">Total</td>
                                                <td className="p-3 text-right">{totalDebits.toFixed(2)}</td>
                                                <td className="p-3 text-right">{totalCredits.toFixed(2)}</td>
                                                <td></td>
                                            </tr>
                                             {difference !== 0 && (
                                                <tr className="border-t">
                                                    <td className="p-3 text-right text-destructive">Difference</td>
                                                    <td className="p-3 text-right font-semibold text-destructive">{difference > 0 ? difference.toFixed(2) : '-'}</td>
                                                    <td className="p-3 text-right font-semibold text-destructive">{difference < 0 ? Math.abs(difference).toFixed(2) : '-'}</td>
                                                    <td></td>
                                                </tr>
                                            )}
                                        </tfoot>
                                    </table>
                                </div>
                                 <div className="p-4 space-y-2">
                                    <Button type="button" variant="outline" size="sm" onClick={handleAddEntry}><PlusCircle className="mr-2 h-4 w-4"/>Add New Line</Button>
                                </div>
                            </section>

                            <Separator className="my-8"/>
                            
                            <section className="mt-8 space-y-4">
                                <div className="space-y-2">
                                    <Label>Narration (Optional)</Label>
                                    <Textarea name="narration" placeholder="Add a description for this entry..." />
                                </div>
                                <div className="space-y-2">
                                    <Label>Attachments (Optional)</Label>
                                    <Input type="file" multiple />
                                </div>
                            </section>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    );
}

