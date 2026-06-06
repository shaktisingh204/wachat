'use client';

import { Input, Label, Switch, useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import { useActionState } from 'react';

/**
 * <VoucherBookForm> — sectioned form for /new and /[id]/edit on Voucher Books.
 * Builds on <EntityFormShell>. Preserves the action's FormData keys, plus
 * `prefix`, `suffix`, `startingNumber`, `padding`, `resetFrequency`,
 * `approvalRequired`, `isActive`, `isDefault`.
 */

import * as React from 'react';

import { EntityFormShell } from '@/components/crm/entity-form-shell';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { saveVoucherBook } from '@/app/actions/crm-vouchers.actions';
import type { CrmVoucherBook } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import type { VoucherResetFrequency } from './types';

interface VoucherBookFormProps {
    initial?: WithId<CrmVoucherBook> | null;
}

const initialState: { message?: string; error?: string } = {};

export function VoucherBookForm({ initial }: VoucherBookFormProps): React.JSX.Element {
    const isEdit = !!initial;
    const router = useRouter();
    const { toast } = useZoruToast();

    const [state, formAction] = useActionState(saveVoucherBook, initialState);

    React.useEffect(() => {
        if (state.message) {
            toast({ title: 'Saved', description: state.message });
            router.push('/dashboard/crm/accounting/vouchers');
        } else if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, router, toast]);

    const init = initial as
        | (WithId<CrmVoucherBook> & {
              prefix?: string;
              suffix?: string;
              startingNumber?: number;
              padding?: number;
              resetFrequency?: VoucherResetFrequency;
              approvalRequired?: boolean;
              isActive?: boolean;
          })
        | null
        | undefined;

    return (
        <EntityFormShell
            title={isEdit ? `Edit ${init?.name}` : 'New Voucher Book'}
            subtitle={
                isEdit
                    ? 'Adjust the book metadata, prefix scheme, and approval rules.'
                    : 'Create a new voucher book for a specific transaction type.'
            }
            action={formAction}
            submitLabel={isEdit ? 'Save changes' : 'Create voucher book'}
            cancelHref={
                isEdit
                    ? `/dashboard/crm/accounting/vouchers/${init!._id.toString()}`
                    : '/dashboard/crm/accounting/vouchers'
            }
            hiddenInputs={
                isEdit ? <input type="hidden" name="voucherBookId" value={init!._id.toString()} /> : null
            }
            error={state.error}
            message={state.message}
            sections={[
                {
                    id: 'header',
                    title: 'Header',
                    description: 'Book identity and transaction type.',
                    children: (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="voucherBookType">Type *</Label>
                                <EnumFormField
                                    name="voucherBookType"
                                    enumName="voucherType"
                                    initialId={init?.type ?? null}
                                    required
                                    placeholder="Pick a voucher type"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="voucherBookName">Name *</Label>
                                <Input
                                    id="voucherBookName"
                                    name="voucherBookName"
                                    placeholder="e.g. Sales Voucher — FY 2025-26"
                                    required
                                    defaultValue={init?.name}
                                />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'numbering',
                    title: 'Numbering scheme',
                    description: 'Prefix / starting number / padding / reset frequency.',
                    children: (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                            <div className="space-y-2">
                                <Label htmlFor="prefix">Prefix</Label>
                                <Input
                                    id="prefix"
                                    name="prefix"
                                    placeholder="e.g. SV-"
                                    defaultValue={init?.prefix ?? ''}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="suffix">Suffix</Label>
                                <Input
                                    id="suffix"
                                    name="suffix"
                                    placeholder="e.g. /FY25"
                                    defaultValue={init?.suffix ?? ''}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="startingNumber">Starting number</Label>
                                <Input
                                    id="startingNumber"
                                    name="startingNumber"
                                    type="number"
                                    min="0"
                                    defaultValue={init?.startingNumber ?? 1}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="padding">Padding</Label>
                                <Input
                                    id="padding"
                                    name="padding"
                                    type="number"
                                    min="0"
                                    max="10"
                                    defaultValue={init?.padding ?? 4}
                                />
                                <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                                    Pads numbers with leading zeros to this width.
                                </p>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="resetFrequency">Reset frequency</Label>
                                <EnumFormField
                                    name="resetFrequency"
                                    enumName="voucherResetFrequency"
                                    initialId={(init?.resetFrequency ?? 'none') as VoucherResetFrequency}
                                />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'flags',
                    title: 'Defaults + approval',
                    description: 'Mark this as default for the module and require approval before posting.',
                    children: (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <label className="flex items-center justify-between rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
                                <div>
                                    <p className="text-[13px] font-medium text-[var(--st-text)]">Default for type</p>
                                    <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                                        Auto-selected on new voucher entry.
                                    </p>
                                </div>
                                <Switch name="isDefault" defaultChecked={init?.isDefault ?? false} />
                            </label>
                            <label className="flex items-center justify-between rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
                                <div>
                                    <p className="text-[13px] font-medium text-[var(--st-text)]">Approval required</p>
                                    <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                                        Block posting until an approver signs off.
                                    </p>
                                </div>
                                <Switch
                                    name="approvalRequired"
                                    defaultChecked={init?.approvalRequired ?? false}
                                />
                            </label>
                            <label className="flex items-center justify-between rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
                                <div>
                                    <p className="text-[13px] font-medium text-[var(--st-text)]">Active</p>
                                    <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                                        Inactive books stay in history but hide from new-entry pickers.
                                    </p>
                                </div>
                                <Switch
                                    name="isActive"
                                    defaultChecked={init?.isActive ?? true}
                                />
                            </label>
                        </div>
                    ),
                },
            ]}
        />
    );
}
