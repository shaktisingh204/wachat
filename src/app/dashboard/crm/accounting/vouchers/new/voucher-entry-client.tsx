'use client';

/**
 * <NewVoucherEntryClient> — moved from the previous `/new/page.tsx`.
 * Records a single voucher entry (debit + credit legs). The book form
 * is now the default at `/new`; this entry form lives under `?mode=entry`.
 */

import {
    ZoruAlert,
    ZoruAlertDescription,
    ZoruAlertTitle,
    ZoruButton,
    ZoruCard,
    ZoruDatePicker,
    ZoruInput,
    ZoruLabel,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruSeparator,
    ZoruTextarea,
    useZoruToast,
} from '@/components/zoruui';
import { useState, useEffect, useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Trash2, ArrowLeft, Save, LoaderCircle, AlertCircle } from 'lucide-react';
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
        <ZoruButton type="submit" disabled={pending || disabled}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Submit
        </ZoruButton>
    );
}

type VoucherEntryItem = {
    id: string;
    accountId: string;
    remark?: string;
    currency: string;
    amount: number;
};

interface LineItemsSectionProps {
    title: string;
    items: VoucherEntryItem[];
    setItems: React.Dispatch<React.SetStateAction<VoucherEntryItem[]>>;
    currency: string;
}

function LineItemsSection({ title, items, setItems, currency }: LineItemsSectionProps) {
    const handleAddItem = () => {
        setItems([...items, { id: uuidv4(), accountId: '', currency, amount: 0 }]);
    };

    const handleRemoveItem = (id: string) => {
        if (items.length > 1) setItems(items.filter((item) => item.id !== id));
    };

    const handleItemChange = (id: string, field: keyof VoucherEntryItem, value: string | number) => {
        setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
    };

    const totalAmount = items.reduce((sum, item) => sum + Number(item.amount), 0);

    return (
        <section>
            <div className="flex justify-between items-baseline mb-2">
                <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
                <p className="text-[13px] font-medium text-foreground">
                    Total: {new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalAmount)}
                </p>
            </div>
            <div className="space-y-3">
                {items.map((item, index) => (
                    <div key={item.id} className="p-3 border border-border rounded-lg bg-secondary space-y-3">
                        <div className="flex justify-between items-center">
                            <ZoruLabel>Item {index + 1}</ZoruLabel>
                            {items.length > 1 && (
                                <ZoruButton
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleRemoveItem(item.id)}
                                >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </ZoruButton>
                            )}
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <ZoruLabel className="text-xs">Account *</ZoruLabel>
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
                                <ZoruLabel className="text-xs">Remark</ZoruLabel>
                                <ZoruInput
                                    placeholder="Add remark"
                                    value={item.remark || ''}
                                    onChange={(e) => handleItemChange(item.id, 'remark', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <ZoruLabel className="text-xs">Currency *</ZoruLabel>
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
                                <ZoruLabel className="text-xs">Amount *</ZoruLabel>
                                <ZoruInput
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
            <ZoruButton type="button" variant="outline" size="sm" className="mt-3" onClick={handleAddItem}>
                Add line item
            </ZoruButton>
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
    const [currency] = useState('INR');
    const [bookId, setBookId] = useState(presetBookId ?? '');

    const [debitEntries, setDebitEntries] = useState<VoucherEntryItem[]>([
        { id: uuidv4(), accountId: '', currency, amount: 0 },
    ]);
    const [creditEntries, setCreditEntries] = useState<VoucherEntryItem[]>([
        { id: uuidv4(), accountId: '', currency, amount: 0 },
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

    const totalDebits = debitEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const totalCredits = creditEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const difference = totalDebits - totalCredits;
    const businessProfile = user?.businessProfile;

    return (
        <form action={formAction}>
            <input type="hidden" name="debitEntries" value={JSON.stringify(debitEntries)} />
            <input type="hidden" name="creditEntries" value={JSON.stringify(creditEntries)} />
            <input type="hidden" name="date" value={voucherDate?.toISOString()} />

            <div className="max-w-6xl mx-auto flex flex-col gap-6">
                <header className="flex justify-between items-center">
                    <ZoruButton variant="ghost" asChild className="-ml-4 text-muted-foreground hover:text-foreground">
                        <Link href="/dashboard/crm/accounting/vouchers">
                            <ArrowLeft className="mr-2 h-4 w-4" />Back to Voucher Books
                        </Link>
                    </ZoruButton>
                    <div className="flex items-center gap-2">
                        <SaveButton disabled={difference !== 0} />
                    </div>
                </header>
                <ZoruCard className="max-w-4xl mx-auto p-4 sm:p-8 md:p-12">
                    <header className="text-center mb-8">
                        <h1 className="text-[26px] font-semibold text-accent-foreground">New Voucher Entry</h1>
                        <p className="mt-1 text-[13px] text-muted-foreground">Record a new journal entry.</p>
                    </header>

                    {!businessProfile?.name && (
                        <ZoruAlert variant="destructive" className="mb-6">
                            <AlertCircle className="h-4 w-4" />
                            <ZoruAlertTitle>Business profile incomplete</ZoruAlertTitle>
                            <ZoruAlertDescription>
                                Complete your business profile before posting vouchers.
                                <ZoruButton asChild variant="link" className="p-0 h-auto ml-2">
                                    <Link href="/dashboard/user/settings/profile">Go to settings</Link>
                                </ZoruButton>
                            </ZoruAlertDescription>
                        </ZoruAlert>
                    )}

                    <ZoruSeparator className="my-8" />

                    <section className="grid md:grid-cols-3 gap-4 text-sm mb-8">
                        <div className="space-y-1">
                            <ZoruLabel htmlFor="voucherBookId">Voucher Book *</ZoruLabel>
                            {/* TODO(§1E): VoucherBook needs its own EntityKey before this can move to
                                <EntityFormField>. Keeping the in-memory list bound for now. */}
                            <ZoruSelect name="voucherBookId" required value={bookId} onValueChange={setBookId}>
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
                            </ZoruSelect>
                        </div>
                        <div className="space-y-1">
                            <ZoruLabel htmlFor="voucherNumber">Voucher Number *</ZoruLabel>
                            <ZoruInput id="voucherNumber" name="voucherNumber" required placeholder="e.g. V-001" />
                        </div>
                        <div className="space-y-1">
                            <ZoruLabel>Date *</ZoruLabel>
                            <ZoruDatePicker value={voucherDate} onChange={setVoucherDate} />
                        </div>
                        <div className="space-y-1 md:col-span-3">
                            <ZoruLabel htmlFor="note">Note</ZoruLabel>
                            <ZoruTextarea id="note" name="note" placeholder="Add a note" />
                        </div>
                    </section>

                    <LineItemsSection
                        title="Debit accounts"
                        items={debitEntries}
                        setItems={setDebitEntries}
                        currency={currency}
                    />

                    <ZoruSeparator className="my-8" />

                    <LineItemsSection
                        title="Credit accounts"
                        items={creditEntries}
                        setItems={setCreditEntries}
                        currency={currency}
                    />

                    <ZoruSeparator className="my-8" />

                    <div className="flex justify-end font-semibold text-[15px] p-4">
                        <div className="w-full max-w-sm space-y-2">
                            <div className="flex justify-between text-foreground">
                                <span>Total Debit</span>
                                <span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalDebits)}</span>
                            </div>
                            <div className="flex justify-between text-foreground">
                                <span>Total Credit</span>
                                <span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(totalCredits)}</span>
                            </div>
                            {difference !== 0 && (
                                <div className="flex justify-between text-destructive pt-2 border-t border-border">
                                    <span>Difference</span>
                                    <span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(Math.abs(difference))}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </ZoruCard>
            </div>
        </form>
    );
}
