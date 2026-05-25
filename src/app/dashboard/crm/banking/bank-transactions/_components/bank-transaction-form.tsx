'use client';

import { Button, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload,
  X } from 'lucide-react';

import { EntityFormShell } from '@/components/crm/entity-form-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';

/**
 * <BankTransactionForm/> — shared by /bank-transactions/new and
 * /[id]/edit (§1B W7).
 *
 * Preserves FormData keys consumed by `saveBankTransaction`: id (hidden,
 * edit only), accountId, transactionDate, amount, type, status,
 * description, referenceNumber, category, balanceAfter, sourceFileUrl.
 * Source statement file uses <SabFilePickerButton> — no URL paste.
 */

import * as React from 'react';

import { SabFilePickerButton } from '@/components/sabfiles';

import {
    saveBankTransaction,
    type CrmBankTransactionRow,
    type CrmBankTransactionStatus,
    type CrmBankTransactionType,
} from '@/app/actions/crm-bank-transactions.actions';

export interface PaymentAccountOption {
    _id: string;
    accountName: string;
}

export interface BankTransactionFormProps {
    mode: 'new' | 'edit';
    initial?: CrmBankTransactionRow | null;
    accounts: PaymentAccountOption[];
    /** Optionally pre-select an account (used by `/new`). */
    presetAccountId?: string;
    /** Server-provided default date to prevent hydration mismatch */
    defaultDate?: string;
}

function isoToDateInput(iso: string | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

export function BankTransactionForm({
    mode,
    initial,
    accounts,
    presetAccountId,
    defaultDate: serverDefaultDate,
}: BankTransactionFormProps): React.JSX.Element {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [state, formAction] = useActionState(saveBankTransaction, {
        message: '',
        error: '',
    } as { message?: string; error?: string; id?: string });

    const [sourceFileUrl, setSourceFileUrl] = useState<string>(
        initial?.sourceFileUrl ?? '',
    );
    const [sourceFileName, setSourceFileName] = useState<string>('');
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const target = state.id
                ? `/dashboard/crm/banking/bank-transactions/${state.id}`
                : '/dashboard/crm/banking/bank-transactions';
            router.push(target);
        }
        if (state?.error) {
            toast({
                title: 'Save failed',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router]);

    const defaultAccountId =
        initial?.accountId ?? presetAccountId ?? accounts[0]?._id ?? '';
    
    // For hydration stability: use server default if provided, fallback to client-side date only after mount, 
    // or use initial date if editing.
    const initialDateStr = initial?.transactionDate ? isoToDateInput(initial.transactionDate) : undefined;
    const computedDefaultDate =
        initialDateStr || serverDefaultDate || (isMounted ? new Date().toISOString().slice(0, 10) : '');
    
    const defaultType: CrmBankTransactionType = initial?.type ?? 'debit';
    const defaultStatus: CrmBankTransactionStatus = initial?.status ?? 'pending';

    return (
        <EntityFormShell
            title={mode === 'edit' ? 'Edit transaction' : 'New transaction'}
            subtitle="Manually record a single statement-level transaction on a payment account."
            action={formAction}
            cancelHref="/dashboard/crm/banking/bank-transactions"
            submitLabel={mode === 'edit' ? 'Save changes' : 'Create transaction'}
            error={state?.error}
            message={state?.message}
            hiddenInputs={
                <>
                    {initial?._id ? (
                        <input type="hidden" name="id" value={initial._id} />
                    ) : null}
                    <input
                        type="hidden"
                        name="sourceFileUrl"
                        value={sourceFileUrl}
                    />
                </>
            }
            sections={[
                {
                    id: 'core',
                    title: 'Account & amount',
                    description: 'Which account, when, and how much.',
                    children: (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <Label htmlFor="accountId">
                                    Account <span className="text-zoru-danger-ink">*</span>
                                </Label>
                                <div className="mt-1.5">
                                    <EntityFormField
                                        entity="bankAccount"
                                        name="accountId"
                                        initialId={defaultAccountId || null}
                                        initialLabel={
                                            accounts.find((a) => a._id === defaultAccountId)?.accountName
                                        }
                                        required
                                        allowCreate
                                        placeholder="Pick a payment account"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="transactionDate">
                                    Date <span className="text-zoru-danger-ink">*</span>
                                </Label>
                                <Input
                                    id="transactionDate"
                                    name="transactionDate"
                                    type="date"
                                    required
                                    defaultValue={computedDefaultDate}
                                    className="mt-1.5 h-10"
                                />
                            </div>
                            <div>
                                <Label htmlFor="amount">
                                    Amount <span className="text-zoru-danger-ink">*</span>
                                </Label>
                                <Input
                                    id="amount"
                                    name="amount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    defaultValue={
                                        initial?.amount != null
                                            ? String(initial.amount)
                                            : ''
                                    }
                                    className="mt-1.5 h-10"
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <Label htmlFor="type">
                                    Direction <span className="text-zoru-danger-ink">*</span>
                                </Label>
                                <div className="mt-1.5">
                                    <EnumFormField
                                        name="type"
                                        enumName="bankTransactionDirection"
                                        initialId={defaultType}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="balanceAfter">Balance after</Label>
                                <Input
                                    id="balanceAfter"
                                    name="balanceAfter"
                                    type="number"
                                    step="0.01"
                                    defaultValue={
                                        initial?.balanceAfter != null
                                            ? String(initial.balanceAfter)
                                            : ''
                                    }
                                    className="mt-1.5 h-10"
                                    placeholder="Optional"
                                />
                            </div>
                            <div>
                                <Label htmlFor="status">Status</Label>
                                <div className="mt-1.5">
                                    <EnumFormField
                                        name="status"
                                        enumName="bankTransactionStatus"
                                        initialId={defaultStatus}
                                    />
                                </div>
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'meta',
                    title: 'Description & reference',
                    description: 'Free-text fields for context and matching.',
                    children: (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    rows={3}
                                    defaultValue={initial?.description ?? ''}
                                    className="mt-1.5"
                                    placeholder="What is this transaction for?"
                                />
                            </div>
                            <div>
                                <Label htmlFor="referenceNumber">
                                    Reference number
                                </Label>
                                <Input
                                    id="referenceNumber"
                                    name="referenceNumber"
                                    defaultValue={initial?.referenceNumber ?? ''}
                                    className="mt-1.5 h-10 font-mono text-[12px]"
                                    placeholder="e.g. UTR-1234567"
                                />
                            </div>
                            <div>
                                <Label htmlFor="category">Category</Label>
                                <Input
                                    id="category"
                                    name="category"
                                    defaultValue={initial?.category ?? ''}
                                    className="mt-1.5 h-10"
                                    placeholder="e.g. salary, vendor-payment"
                                />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'attachment',
                    title: 'Source statement (optional)',
                    description:
                        'Attach a CSV/PDF statement from SabFiles — no external URL paste.',
                    children: (
                        <div>
                            <SabFilePickerButton
                                accept="all"
                                title="Pick a statement file"
                                onPick={({ url, name }) => {
                                    setSourceFileUrl(url);
                                    setSourceFileName(name ?? '');
                                }}
                            >
                                <Upload className="h-4 w-4" />
                                {sourceFileUrl ? 'Replace file' : 'Attach file'}
                            </SabFilePickerButton>
                            {sourceFileUrl ? (
                                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-zoru-line px-2 py-1.5">
                                    <span className="truncate text-[12px] text-zoru-ink">
                                        {sourceFileName || sourceFileUrl}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        aria-label="Remove file"
                                        onClick={() => {
                                            setSourceFileUrl('');
                                            setSourceFileName('');
                                        }}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    ),
                },
            ]}
        />
    );
}

export default BankTransactionForm;
