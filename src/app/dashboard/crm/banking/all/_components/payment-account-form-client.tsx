'use client';

/**
 * <PaymentAccountFormClient> — form for /new and /[id]/edit on payment accounts.
 *
 * Preserves the action's FormData keys (`accountId`, `accountType`, `accountName`,
 * `bankAccountDetails`, `openingBalance`, `openingBalanceDate`, `currency`,
 * `isDefault`, `status`). Adds optional ledger / VPA / SWIFT / IBAN fields under
 * a "Connections" section (server-side currently stores them on `bankDetails`).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useActionState } from 'react';

import {
    ZoruDatePicker,
    ZoruInput,
    ZoruLabel,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruSwitch,
    useZoruToast,
} from '@/components/zoruui';

import { EntityFormShell } from '@/components/crm/entity-form-shell';
import { saveCrmPaymentAccount } from '@/app/actions/crm-payment-accounts.actions';
import type { CrmPaymentAccount, BankAccountDetails } from '@/lib/definitions';
import type { WithId } from 'mongodb';

interface PaymentAccountFormClientProps {
    initial?: WithId<CrmPaymentAccount> | null;
}

const initialState: { message?: string; error?: string } = {};

export function PaymentAccountFormClient({
    initial,
}: PaymentAccountFormClientProps): React.JSX.Element {
    const isEdit = !!initial;
    const router = useRouter();
    const { toast } = useZoruToast();

    const [state, formAction] = useActionState(saveCrmPaymentAccount, initialState);

    const [accountType, setAccountType] = React.useState<CrmPaymentAccount['accountType']>(
        initial?.accountType ?? 'bank',
    );
    const [bankDetails, setBankDetails] = React.useState<Partial<BankAccountDetails>>(
        initial?.bankDetails ?? {},
    );
    const [openingBalanceDate, setOpeningBalanceDate] = React.useState<Date | undefined>(
        initial?.openingBalanceDate ? new Date(initial.openingBalanceDate) : new Date(),
    );

    React.useEffect(() => {
        if (state.message) {
            toast({ title: 'Saved', description: state.message });
            router.push(
                isEdit
                    ? `/dashboard/crm/banking/all/${initial!._id.toString()}`
                    : '/dashboard/crm/banking/all',
            );
        } else if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, isEdit, initial, router, toast]);

    return (
        <EntityFormShell
            title={isEdit ? `Edit ${initial?.accountName}` : 'New Payment Account'}
            subtitle={
                isEdit
                    ? 'Update account details, bank info, and default flags.'
                    : 'Add a bank, cash, employee, wallet or other payment account.'
            }
            action={formAction}
            submitLabel={isEdit ? 'Save changes' : 'Add account'}
            cancelHref={
                isEdit
                    ? `/dashboard/crm/banking/all/${initial!._id.toString()}`
                    : '/dashboard/crm/banking/all'
            }
            hiddenInputs={
                <>
                    {isEdit ? <input type="hidden" name="accountId" value={initial!._id.toString()} /> : null}
                    <input
                        type="hidden"
                        name="bankAccountDetails"
                        value={JSON.stringify(bankDetails)}
                    />
                    <input
                        type="hidden"
                        name="openingBalanceDate"
                        value={openingBalanceDate?.toISOString() ?? ''}
                    />
                </>
            }
            error={state.error}
            message={state.message}
            sections={[
                {
                    id: 'details',
                    title: 'Account details',
                    description: 'Name, type and currency.',
                    children: (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="accountType">Type *</ZoruLabel>
                                <ZoruSelect
                                    name="accountType"
                                    required
                                    value={accountType}
                                    onValueChange={(v) => setAccountType(v as CrmPaymentAccount['accountType'])}
                                >
                                    <ZoruSelectTrigger id="accountType">
                                        <ZoruSelectValue />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="bank">Bank</ZoruSelectItem>
                                        <ZoruSelectItem value="cash">Cash</ZoruSelectItem>
                                        <ZoruSelectItem value="employee">Employee</ZoruSelectItem>
                                        <ZoruSelectItem value="wallet">Wallet</ZoruSelectItem>
                                        <ZoruSelectItem value="other">Other</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="accountName">Account name *</ZoruLabel>
                                <ZoruInput
                                    id="accountName"
                                    name="accountName"
                                    required
                                    placeholder="e.g. HDFC Current"
                                    defaultValue={initial?.accountName ?? ''}
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="currency">Currency *</ZoruLabel>
                                <ZoruSelect name="currency" required defaultValue={initial?.currency ?? 'INR'}>
                                    <ZoruSelectTrigger id="currency">
                                        <ZoruSelectValue />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="INR">Indian Rupee (INR)</ZoruSelectItem>
                                        <ZoruSelectItem value="USD">US Dollar (USD)</ZoruSelectItem>
                                        <ZoruSelectItem value="EUR">Euro (EUR)</ZoruSelectItem>
                                        <ZoruSelectItem value="GBP">British Pound (GBP)</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                        </div>
                    ),
                },
                ...(accountType === 'bank'
                    ? [
                          {
                              id: 'bank',
                              title: 'Bank details',
                              description: 'Used for printed cheques, NEFT/UPI, and statement import.',
                              children: (
                                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                      <div className="space-y-2">
                                          <ZoruLabel>Bank name</ZoruLabel>
                                          <ZoruInput
                                              placeholder="e.g. HDFC Bank"
                                              value={bankDetails.bankName ?? ''}
                                              onChange={(e) =>
                                                  setBankDetails((prev) => ({
                                                      ...prev,
                                                      bankName: e.target.value,
                                                  }))
                                              }
                                          />
                                      </div>
                                      <div className="space-y-2">
                                          <ZoruLabel>Account holder</ZoruLabel>
                                          <ZoruInput
                                              value={bankDetails.accountHolder ?? ''}
                                              onChange={(e) =>
                                                  setBankDetails((prev) => ({
                                                      ...prev,
                                                      accountHolder: e.target.value,
                                                  }))
                                              }
                                          />
                                      </div>
                                      <div className="space-y-2">
                                          <ZoruLabel>Account number</ZoruLabel>
                                          <ZoruInput
                                              value={bankDetails.accountNumber ?? ''}
                                              onChange={(e) =>
                                                  setBankDetails((prev) => ({
                                                      ...prev,
                                                      accountNumber: e.target.value,
                                                  }))
                                              }
                                          />
                                      </div>
                                      <div className="space-y-2">
                                          <ZoruLabel>IFSC</ZoruLabel>
                                          <ZoruInput
                                              value={bankDetails.ifsc ?? ''}
                                              onChange={(e) =>
                                                  setBankDetails((prev) => ({
                                                      ...prev,
                                                      ifsc: e.target.value.toUpperCase(),
                                                  }))
                                              }
                                          />
                                      </div>
                                      <div className="space-y-2">
                                          <ZoruLabel>Bank account type</ZoruLabel>
                                          <ZoruSelect
                                              value={bankDetails.accountType ?? ''}
                                              onValueChange={(v) =>
                                                  setBankDetails((prev) => ({
                                                      ...prev,
                                                      accountType: v as 'current' | 'savings',
                                                  }))
                                              }
                                          >
                                              <ZoruSelectTrigger>
                                                  <ZoruSelectValue placeholder="Pick…" />
                                              </ZoruSelectTrigger>
                                              <ZoruSelectContent>
                                                  <ZoruSelectItem value="current">Current</ZoruSelectItem>
                                                  <ZoruSelectItem value="savings">Savings</ZoruSelectItem>
                                              </ZoruSelectContent>
                                          </ZoruSelect>
                                      </div>
                                      <div className="space-y-2">
                                          <ZoruLabel>SWIFT</ZoruLabel>
                                          <ZoruInput
                                              value={bankDetails.swiftCode ?? ''}
                                              onChange={(e) =>
                                                  setBankDetails((prev) => ({
                                                      ...prev,
                                                      swiftCode: e.target.value.toUpperCase(),
                                                  }))
                                              }
                                          />
                                      </div>
                                      <div className="space-y-2 md:col-span-2">
                                          <ZoruLabel>IBAN</ZoruLabel>
                                          <ZoruInput
                                              value={bankDetails.ibanCode ?? ''}
                                              onChange={(e) =>
                                                  setBankDetails((prev) => ({
                                                      ...prev,
                                                      ibanCode: e.target.value.toUpperCase(),
                                                  }))
                                              }
                                          />
                                      </div>
                                  </div>
                              ),
                          },
                      ]
                    : []),
                {
                    id: 'opening',
                    title: 'Opening balance',
                    description: 'Initial balance carried from your previous accounting period.',
                    children: (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="openingBalance">Opening balance *</ZoruLabel>
                                <ZoruInput
                                    id="openingBalance"
                                    name="openingBalance"
                                    type="number"
                                    min="-100000000000"
                                    max="100000000000"
                                    step="0.01"
                                    defaultValue={initial?.openingBalance ?? 0}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>As of *</ZoruLabel>
                                <ZoruDatePicker value={openingBalanceDate} onChange={setOpeningBalanceDate} />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'flags',
                    title: 'Flags',
                    description: 'Defaults + activation.',
                    children: (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <label className="flex items-center justify-between rounded-lg border border-border bg-secondary p-3">
                                <div>
                                    <p className="text-[13px] font-medium text-foreground">Default account</p>
                                    <p className="text-[11.5px] text-muted-foreground">
                                        Selected by default on new payments / receipts.
                                    </p>
                                </div>
                                <ZoruSwitch name="isDefault" defaultChecked={initial?.isDefault ?? false} />
                            </label>
                            <label className="flex items-center justify-between rounded-lg border border-border bg-secondary p-3">
                                <div>
                                    <p className="text-[13px] font-medium text-foreground">Active</p>
                                    <p className="text-[11.5px] text-muted-foreground">
                                        Inactive accounts stay in history but hide from pickers.
                                    </p>
                                </div>
                                <ZoruSwitch
                                    name="status"
                                    defaultChecked={initial ? initial.status === 'active' : true}
                                />
                            </label>
                        </div>
                    ),
                },
            ]}
        />
    );
}
