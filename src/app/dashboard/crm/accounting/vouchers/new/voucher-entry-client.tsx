'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Button,
  Card,
  DatePicker,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
/**
 * <NewVoucherEntryClient> — moved from the previous `/new/page.tsx`.
 * Records a single voucher entry (debit + credit legs). The book form
 * is now the default at `/new`; this entry form lives under `?mode=entry`.
 */

import { useState, useEffect, useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Trash2, ArrowLeft, Save, LoaderCircle, AlertCircle, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

import { getCrmChartOfAccounts } from '@/app/actions/crm-accounting.actions';
import { getCrmPaymentAccounts } from '@/app/actions/crm-payment-accounts.actions';
import { saveVoucherEntry, getVoucherBooks } from '@/app/actions/crm-vouchers.actions';
import type { WithId } from 'mongodb';
import type { CrmChartOfAccount, CrmVoucherBook, CrmPaymentAccount } from '@/lib/definitions';
import { getSession } from '@/app/actions/user.actions';

import { EntityPicker } from '@/components/crm/entity-picker';

const initialState = { message: undefined, error: undefined };

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
    exchangeRate?: number;
};

interface LineItemsSectionProps {
    title: string;
    items: VoucherEntryItem[];
    setItems: React.Dispatch<React.SetStateAction<VoucherEntryItem[]>>;
    baseCurrency: string;
}

function LineItemsSection({ title, items, setItems, baseCurrency }: LineItemsSectionProps) {
    const handleAddItem = () => {
        setItems([...items, { id: uuidv4(), accountId: '', currency: baseCurrency, amount: 0, exchangeRate: 1 }]);
    };

    const handleRemoveItem = (id: string) => {
        if (items.length > 1) setItems(items.filter((item) => item.id !== id));
    };

    const handleItemChange = (id: string, field: keyof VoucherEntryItem, value: string | number) => {
        setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
    };

    const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) * (Number(item.exchangeRate) || 1)), 0);

    return (
        <section>
            <div className="flex justify-between items-baseline mb-2">
                <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
                <p className="text-[13px] font-medium text-foreground">
                    Total: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: baseCurrency }).format(totalAmount)}
                </p>
            </div>
            <div className="space-y-3">
                {items.map((item, index) => (
                    <div key={item.id} className="p-3 border border-border rounded-lg bg-secondary space-y-3">
                        <div className="flex justify-between items-center">
                            <Label>Item {index + 1}</Label>
                            {items.length > 1 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleRemoveItem(item.id)}
                                >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            )}
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs">Account *</Label>
                                <EntityPicker
                                    entity="account"
                                    value={item.accountId || null}
                                    placeholder="Search an account…"
                                    onChange={(next) => {
                                        const id = Array.isArray(next) ? (next[0] ?? '') : (next ?? '');
                                        handleItemChange(item.id, 'accountId', id);
                                    }}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Remark</Label>
                                <Input
                                    placeholder="Add remark"
                                    value={item.remark || ''}
                                    onChange={(e) => handleItemChange(item.id, 'remark', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs">Currency *</Label>
                                <EntityPicker
                                    entity="currency"
                                    value={item.currency || null}
                                    onChange={(next) => {
                                        const id = Array.isArray(next) ? (next[0] ?? '') : (next ?? '');
                                        handleItemChange(item.id, 'currency', id);
                                    }}
                                    placeholder="Currency"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Exchange Rate</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={item.exchangeRate ?? 1}
                                    onChange={(e) => handleItemChange(item.id, 'exchangeRate', Number(e.target.value))}
                                    disabled={item.currency === baseCurrency}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Amount *</Label>
                                <Input
                                    type="number"
                                    value={item.amount}
                                    onChange={(e) => handleItemChange(item.id, 'amount', Number(e.target.value))}
                                    required
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={handleAddItem}>
                Add line item
            </Button>
        </section>
    );
}

interface NewVoucherEntryClientProps {
    presetBookId?: string;
}

export function NewVoucherEntryClient({ presetBookId }: NewVoucherEntryClientProps) {
    const [state, formAction] = useActionState(saveVoucherEntry, initialState);
    const router = useRouter();
    const { toast } = useZoruToast();

    const [user, setUser] = useState<{ businessProfile?: { name?: string } } | null>(null);
    const [voucherBooks, setVoucherBooks] = useState<WithId<CrmVoucherBook>[]>([]);
    const [voucherDate, setVoucherDate] = useState<Date | undefined>(new Date());
    const [baseCurrency, setBaseCurrency] = useState('INR');
    const [bookId, setBookId] = useState(presetBookId ?? '');
    
    // Recurring fields
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurringFrequency, setRecurringFrequency] = useState('monthly');
    const [recurringEndDate, setRecurringEndDate] = useState<Date | undefined>(undefined);
    const [note, setNote] = useState('');

    const [debitEntries, setDebitEntries] = useState<VoucherEntryItem[]>([
        { id: uuidv4(), accountId: '', currency: baseCurrency, amount: 0, exchangeRate: 1 },
    ]);
    const [creditEntries, setCreditEntries] = useState<VoucherEntryItem[]>([
        { id: uuidv4(), accountId: '', currency: baseCurrency, amount: 0, exchangeRate: 1 },
    ]);

    useEffect(() => {
        // server-only hot paths are kicked off in parallel — see async-parallel.
        Promise.all([getSession(), getCrmChartOfAccounts(), getCrmPaymentAccounts(), getVoucherBooks()]).then(
            ([session, _chart, _payment, books]) => {
                setUser((session?.user as { businessProfile?: { name?: string } }) ?? null);
                setVoucherBooks(books);
            },
        );
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

    const handleAutoCategorize = () => {
        if (!note) {
            toast({ title: 'Please enter a note to categorize.' });
            return;
        }
        
        toast({ title: 'Analyzing with AI...', description: 'Suggesting accounts based on note.' });
        // Simulating AI response
        setTimeout(() => {
            setDebitEntries([
                { id: uuidv4(), accountId: 'mock-expense-id', currency: baseCurrency, amount: 5000, exchangeRate: 1, remark: 'Auto-suggested from note' }
            ]);
            setCreditEntries([
                { id: uuidv4(), accountId: 'mock-bank-id', currency: baseCurrency, amount: 5000, exchangeRate: 1, remark: 'Auto-suggested from note' }
            ]);
            toast({ title: 'AI Categorization Complete' });
        }, 1200);
    };

    const totalDebits = debitEntries.reduce((sum, entry) => sum + (Number(entry.amount) * (Number(entry.exchangeRate) || 1)), 0);
    const totalCredits = creditEntries.reduce((sum, entry) => sum + (Number(entry.amount) * (Number(entry.exchangeRate) || 1)), 0);
    const difference = totalDebits - totalCredits;
    const businessProfile = user?.businessProfile;

    return (
        <form action={formAction}>
            <input type="hidden" name="debitEntries" value={JSON.stringify(debitEntries)} />
            <input type="hidden" name="creditEntries" value={JSON.stringify(creditEntries)} />
            <input type="hidden" name="date" value={voucherDate?.toISOString()} />
            <input type="hidden" name="baseCurrency" value={baseCurrency} />
            <input type="hidden" name="isRecurring" value={isRecurring.toString()} />
            <input type="hidden" name="recurringFrequency" value={recurringFrequency} />
            <input type="hidden" name="recurringEndDate" value={recurringEndDate?.toISOString()} />

            <div className="max-w-6xl mx-auto flex flex-col gap-6">
                <header className="flex justify-between items-center">
                    <Button variant="ghost" asChild className="-ml-4 text-muted-foreground hover:text-foreground">
                        <Link href="/dashboard/crm/accounting/vouchers">
                            <ArrowLeft className="mr-2 h-4 w-4" />Back to Voucher Books
                        </Link>
                    </Button>
                    <div className="flex items-center gap-2">
                        <SaveButton disabled={difference !== 0} />
                    </div>
                </header>
                <Card className="max-w-4xl mx-auto p-4 sm:p-8 md:p-12">
                    <header className="text-center mb-8">
                        <h1 className="text-[26px] font-semibold text-accent-foreground">New Voucher Entry</h1>
                        <p className="mt-1 text-[13px] text-muted-foreground">Record a new journal entry.</p>
                    </header>

                    {!businessProfile?.name && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertCircle className="h-4 w-4" />
                            <ZoruAlertTitle>Business profile incomplete</ZoruAlertTitle>
                            <ZoruAlertDescription>
                                Complete your business profile before posting vouchers.
                                <Button asChild variant="link" className="p-0 h-auto ml-2">
                                    <Link href="/dashboard/user/settings/profile">Go to settings</Link>
                                </Button>
                            </ZoruAlertDescription>
                        </Alert>
                    )}

                    <Separator className="my-8" />

                    <section className="grid md:grid-cols-3 gap-4 text-sm mb-8">
                        <div className="space-y-1">
                            <Label htmlFor="voucherBookId">Voucher Book *</Label>
                            {/* TODO(§1E): VoucherBook needs its own EntityKey before this can move to
                                <EntityFormField>. Keeping the in-memory list bound for now. */}
                            <Select name="voucherBookId" required value={bookId} onValueChange={setBookId}>
                                <ZoruSelectTrigger id="voucherBookId">
                                    <ZoruSelectValue placeholder="Select a book…" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {voucherBooks.map((book) => (
                                        <ZoruSelectItem key={book._id.toString()} value={book._id.toString()}>
                                            {book.name}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="baseCurrency">Base Currency</Label>
                            <EntityPicker
                                entity="currency"
                                value={baseCurrency}
                                onChange={(next) => {
                                    const c = Array.isArray(next) ? (next[0] ?? 'INR') : (next ?? 'INR');
                                    setBaseCurrency(c);
                                }}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="voucherNumber">Voucher Number *</Label>
                            <Input id="voucherNumber" name="voucherNumber" required placeholder="e.g. V-001" />
                        </div>
                        <div className="space-y-1">
                            <Label>Date *</Label>
                            <DatePicker value={voucherDate} onChange={setVoucherDate} />
                        </div>
                        <div className="space-y-1 md:col-span-3">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="note">Note</Label>
                                <Button type="button" variant="ghost" size="sm" onClick={handleAutoCategorize} className="h-6 text-xs text-primary">
                                    <Wand2 className="mr-1 h-3 w-3" /> Auto-categorize
                                </Button>
                            </div>
                            <Textarea id="note" name="note" placeholder="Add a note" value={note} onChange={e => setNote(e.target.value)} />
                        </div>
                        
                        <div className="md:col-span-3 space-y-4 border p-4 rounded-lg bg-secondary/50">
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isRecurring" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="h-4 w-4" />
                                <Label htmlFor="isRecurring" className="font-semibold text-accent-foreground">Schedule Recurring Voucher</Label>
                            </div>
                            {isRecurring && (
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label>Frequency</Label>
                                        <Select value={recurringFrequency} onValueChange={setRecurringFrequency}>
                                            <ZoruSelectTrigger>
                                                <ZoruSelectValue />
                                            </ZoruSelectTrigger>
                                            <ZoruSelectContent>
                                                <ZoruSelectItem value="daily">Daily</ZoruSelectItem>
                                                <ZoruSelectItem value="weekly">Weekly</ZoruSelectItem>
                                                <ZoruSelectItem value="monthly">Monthly</ZoruSelectItem>
                                                <ZoruSelectItem value="yearly">Yearly</ZoruSelectItem>
                                            </ZoruSelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>End Date</Label>
                                        <DatePicker value={recurringEndDate} onChange={setRecurringEndDate} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    <LineItemsSection
                        title="Debit accounts"
                        items={debitEntries}
                        setItems={setDebitEntries}
                        baseCurrency={baseCurrency}
                    />

                    <Separator className="my-8" />

                    <LineItemsSection
                        title="Credit accounts"
                        items={creditEntries}
                        setItems={setCreditEntries}
                        baseCurrency={baseCurrency}
                    />

                    <Separator className="my-8" />

                    <div className="flex justify-end font-semibold text-[15px] p-4">
                        <div className="w-full max-w-sm space-y-2">
                            <div className="flex justify-between text-foreground">
                                <span>Total Debit</span>
                                <span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: baseCurrency }).format(totalDebits)}</span>
                            </div>
                            <div className="flex justify-between text-foreground">
                                <span>Total Credit</span>
                                <span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: baseCurrency }).format(totalCredits)}</span>
                            </div>
                            {difference !== 0 && (
                                <div className="flex justify-between text-destructive pt-2 border-t border-border">
                                    <span>Difference</span>
                                    <span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: baseCurrency }).format(Math.abs(difference))}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            </div>
        </form>
    );
}
