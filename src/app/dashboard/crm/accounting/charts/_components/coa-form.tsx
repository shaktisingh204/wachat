'use client';

import { DatePicker, Input, Label, RadioGroup, ZoruRadioGroupItem, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import { useActionState } from 'react';

/**
 * <CoaForm> — sectioned form for /new and /[id]/edit on Chart of Accounts.
 * Builds on <EntityFormShell> (Phase 1A). Preserves the existing FormData keys
 * the server action consumes (`accountId`, `name`, `accountGroupId`,
 * `openingBalance`, `balanceType`, `currency`, `description`, `status`, `code`,
 * `openingBalanceDate`, `affectsGrossProfit`, `taxBehavior`).
 */

import * as React from 'react';

import { EntityFormShell } from '@/components/crm/entity-form-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { saveCrmChartOfAccount } from '@/app/actions/crm-accounting.actions';
import type { CrmAccountGroup, CrmChartOfAccount } from '@/lib/definitions';
import type { WithId } from 'mongodb';

interface CoaFormProps {
    initial?: WithId<CrmChartOfAccount> | null;
    groups: WithId<CrmAccountGroup>[];
}

const initialState: { message?: string; error?: string } = {};

export function CoaForm({ initial, groups }: CoaFormProps): React.JSX.Element {
    const isEdit = !!initial;
    const router = useRouter();
    const { toast } = useToast();

    const [state, formAction] = useActionState(saveCrmChartOfAccount, initialState);

    const [groupId, setGroupId] = React.useState(initial?.accountGroupId?.toString() ?? '');
    const [openingBalanceDate, setOpeningBalanceDate] = React.useState<Date | undefined>(
        new Date(),
    );

    React.useEffect(() => {
        if (state.message) {
            toast({ title: 'Saved', description: state.message });
            router.push('/dashboard/crm/accounting/charts');
        } else if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, router, toast]);

    const selectedGroup = groups.find((g) => g._id.toString() === groupId);
    const selectedNature = selectedGroup?.type;

    return (
        <EntityFormShell
            title={isEdit ? `Edit ${initial?.name}` : 'New Account'}
            subtitle={
                isEdit
                    ? 'Adjust the chart-of-account properties below.'
                    : 'Add an account to your chart. Use the parent group to keep your CoA navigable.'
            }
            action={formAction}
            submitLabel={isEdit ? 'Save changes' : 'Create account'}
            cancelHref={
                isEdit
                    ? `/dashboard/crm/accounting/charts/${initial?._id.toString()}`
                    : '/dashboard/crm/accounting/charts'
            }
            hiddenInputs={
                <>
                    {isEdit ? <input type="hidden" name="accountId" value={initial!._id.toString()} /> : null}
                    <input type="hidden" name="accountGroupId" value={groupId} />
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
                    id: 'header',
                    title: 'Header',
                    description: 'Account identification and parent grouping.',
                    children: (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="code">Account code</Label>
                                <Input
                                    id="code"
                                    name="code"
                                    placeholder="e.g. 1100"
                                    defaultValue={(initial as { code?: string } | null | undefined)?.code ?? ''}
                                />
                                <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                                    Optional. Useful for chart numbering schemes.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="name">Account name *</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    placeholder="e.g. Bank — HDFC Current"
                                    required
                                    defaultValue={initial?.name ?? ''}
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="accountGroupId">Parent group *</Label>
                                {/* TODO(§1E): Account groups need their own EntityKey before this can move
                                    to <EntityFormField>. Keeping the SSR-passed `groups` array bound to
                                    the in-page state for now so the parent dropdown stays functional. */}
                                <Select value={groupId} onValueChange={setGroupId}>
                                    <SelectTrigger id="accountGroupId">
                                        <SelectValue placeholder="Select an account group" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {groups.length === 0 ? (
                                            <SelectItem value="__placeholder__" disabled>
                                                No groups yet — create one under Account Groups
                                            </SelectItem>
                                        ) : (
                                            groups.map((g) => (
                                                <SelectItem key={g._id.toString()} value={g._id.toString()}>
                                                    {g.name} · {g.type} · {g.category.replace(/_/g, ' ')}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                {selectedNature ? (
                                    <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                                        Nature: <strong>{selectedNature}</strong> ·{' '}
                                        Sub-nature: <strong>{selectedGroup?.category.replace(/_/g, ' ')}</strong>
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'opening',
                    title: 'Opening balance',
                    description:
                        'Carry-forward value from your previous accounting system. Choose the side (Dr/Cr) carefully.',
                    children: (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="openingBalance">Opening balance</Label>
                                <Input
                                    id="openingBalance"
                                    name="openingBalance"
                                    type="number"
                                    step="0.01"
                                    min="-100000000000"
                                    max="100000000000"
                                    defaultValue={initial?.openingBalance ?? 0}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Balance type</Label>
                                <RadioGroup
                                    name="balanceType"
                                    defaultValue={initial?.balanceType ?? 'Dr'}
                                    className="flex items-center gap-4 pt-1"
                                >
                                    <label className="inline-flex items-center gap-2">
                                        <ZoruRadioGroupItem value="Dr" id="balanceType-dr" />
                                        <span className="text-[13px]">Debit</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2">
                                        <ZoruRadioGroupItem value="Cr" id="balanceType-cr" />
                                        <span className="text-[13px]">Credit</span>
                                    </label>
                                </RadioGroup>
                            </div>
                            <div className="space-y-2">
                                <Label>As of</Label>
                                <DatePicker
                                    value={openingBalanceDate}
                                    onChange={setOpeningBalanceDate}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="currency">Currency</Label>
                                <EntityFormField
                                    entity="currency"
                                    name="currency"
                                    initialId={initial?.currency ?? 'INR'}
                                    allowCreate
                                />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'tax',
                    title: 'Tax + behavior',
                    description: 'Optional accounting metadata for reporting / GST treatment.',
                    children: (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Tax behavior</Label>
                                <EnumFormField
                                    name="taxBehavior"
                                    enumName="accountTaxBehavior"
                                    initialId={(initial as { taxBehavior?: string } | null | undefined)?.taxBehavior ?? 'none'}
                                />
                            </div>
                            <label className="flex items-center justify-between rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
                                <div>
                                    <p className="text-[13px] font-medium text-[var(--st-text)]">
                                        Affects gross profit
                                    </p>
                                    <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                                        Include this account in COGS / gross-profit calculations.
                                    </p>
                                </div>
                                <Switch
                                    name="affectsGrossProfit"
                                    defaultChecked={
                                        (initial as { affectsGrossProfit?: boolean } | null | undefined)
                                            ?.affectsGrossProfit ?? false
                                    }
                                />
                            </label>
                        </div>
                    ),
                },
                {
                    id: 'meta',
                    title: 'Description + status',
                    description: 'Optional notes and active flag.',
                    children: (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    rows={3}
                                    placeholder="What is this account used for?"
                                    defaultValue={initial?.description ?? ''}
                                />
                            </div>
                            <label className="flex items-center justify-between rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
                                <div>
                                    <p className="text-[13px] font-medium text-[var(--st-text)]">Active</p>
                                    <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                                        Inactive accounts stay in your history but hide from pickers.
                                    </p>
                                </div>
                                <Switch
                                    name="status"
                                    defaultChecked={initial ? initial.status === 'Active' : true}
                                />
                            </label>
                        </div>
                    ),
                },
            ]}
        />
    );
}
