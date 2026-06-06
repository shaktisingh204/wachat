'use client';

/**
 * <PettyCashEditForm> — deepened edit form per CRM_PAGE_REDESIGN_PLAN
 * §3.3.2.
 *
 * Sectioned cards (no tabs — zoruui has no tab primitive):
 *   1. Identification — float name, branch picker, currency
 *   2. Custody & approvals — custodian (employee), approver (user),
 *      approval workflow status
 *   3. Balances — opening, current (read-only), reconcile date readout
 *   4. Policy document — single SabFiles attachment (charter / policy
 *      PDF)
 *   5. Notes
 *
 * Backward compatible: `approverId`, `approverName`, `currency`,
 * `policyFileId/Url/Name` are written when present; legacy floats load
 * fine. The action is extended additively in
 * `crm-petty-cash.actions.ts::updatePettyCashFloat`.
 */

import * as React from 'react';
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Textarea } from '@/components/sabcrm/20ui';
import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { FileText, LoaderCircle, Save, X } from 'lucide-react';
import Link from 'next/link';

import { updatePettyCashFloat } from '@/app/actions/crm-petty-cash.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

type FloatStatus = 'active' | 'paused' | 'closed';

interface PettyCashFloat {
    _id?: string;
    name?: string;
    branchId?: string;
    branchName?: string;
    custodianId?: string;
    custodianName?: string;
    approverId?: string;
    approverName?: string;
    openingBalance?: number;
    currentBalance?: number;
    balance?: number;
    currency?: string;
    notes?: string;
    status?: FloatStatus;
    lastReconciledAt?: string;
    policyFileId?: string;
    policyFileUrl?: string;
    policyFileName?: string;
}

const STATUS_OPTIONS: ReadonlyArray<{ value: FloatStatus; label: string }> = [
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'closed', label: 'Closed' },
];

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="gap-1">
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Save className="h-4 w-4" />
            )}
            Save changes
        </Button>
    );
}

export function PettyCashEditForm({ float }: { float: PettyCashFloat }) {
    const [state, action] = useActionState(
        updatePettyCashFloat as unknown as (
            prev: { message?: string; error?: string },
            fd: FormData,
        ) => Promise<{ message?: string; error?: string }>,
        { message: '', error: '' },
    );

    const floatId = String(float._id ?? '');
    const [status, setStatus] = React.useState<FloatStatus>(
        (float.status as FloatStatus) ?? 'active',
    );
    const [policy, setPolicy] = React.useState<SabFilePick | null>(
        float.policyFileId
            ? {
                  id: float.policyFileId,
                  url: float.policyFileUrl ?? '',
                  name: float.policyFileName ?? 'policy',
              }
            : null,
    );

    const currentBalance = float.balance ?? float.currentBalance ?? 0;

    useEffect(() => {
        if (state?.message) {
            window.location.href = `/dashboard/crm/petty-cash/${floatId}`;
        }
    }, [state, floatId]);

    return (
        <form action={action} className="space-y-6">
            <input type="hidden" name="id" value={floatId} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="policyFileId" value={policy?.id ?? ''} />
            <input type="hidden" name="policyFileUrl" value={policy?.url ?? ''} />
            <input type="hidden" name="policyFileName" value={policy?.name ?? ''} />

            <Card>
                <CardHeader>
                    <CardTitle>Identification</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="name">
                                Float name <span className="text-[var(--st-danger)]">*</span>
                            </Label>
                            <Input
                                id="name"
                                name="name"
                                defaultValue={float.name ?? ''}
                                required
                                minLength={2}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Branch</Label>
                            <EntityFormField
                                entity="branch"
                                name="branchId"
                                dualWriteName="branchName"
                                initialId={float.branchId ?? null}
                                initialLabel={float.branchName ?? ''}
                                placeholder="Select branch…"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="currency">Currency</Label>
                            <Input
                                id="currency"
                                name="currency"
                                defaultValue={float.currency ?? 'INR'}
                                maxLength={6}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as FloatStatus)}
                                className="h-10 w-full rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-3 text-[13px] text-[var(--st-text)]"
                            >
                                {STATUS_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Custody & approvals</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Custodian</Label>
                            <EntityFormField
                                entity="employee"
                                name="custodianId"
                                dualWriteName="custodianName"
                                initialId={float.custodianId ?? null}
                                initialLabel={float.custodianName ?? ''}
                                placeholder="Select custodian…"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Approver</Label>
                            <EntityFormField
                                entity="user"
                                name="approverId"
                                dualWriteName="approverName"
                                initialId={float.approverId ?? null}
                                initialLabel={float.approverName ?? ''}
                                placeholder="Select approver…"
                            />
                        </div>
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Balances</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <Label htmlFor="openingBalance">Opening balance</Label>
                            <Input
                                id="openingBalance"
                                name="openingBalance"
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={float.openingBalance ?? 0}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Current balance</Label>
                            <Input
                                value={currentBalance}
                                readOnly
                                aria-readonly
                                className="bg-[var(--st-bg-muted)]/40"
                            />
                            <p className="text-[11px] text-[var(--st-text-secondary)]">
                                Adjusted via top-ups, vouchers and reconciliation.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Last reconciled</Label>
                            <Input
                                value={
                                    float.lastReconciledAt
                                        ? new Date(float.lastReconciledAt).toLocaleDateString()
                                        : '—'
                                }
                                readOnly
                                aria-readonly
                                className="bg-[var(--st-bg-muted)]/40"
                            />
                        </div>
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Policy document</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="flex flex-wrap items-center gap-2">
                        <SabFilePickerButton
                            accept="document"
                            onPick={(pick) => setPolicy(pick)}
                        >
                            {policy ? 'Replace document' : 'Attach document'}
                        </SabFilePickerButton>
                        {policy ? (
                            <span className="inline-flex items-center gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)]/40 px-2 py-1 text-[12.5px] text-[var(--st-text)]">
                                <FileText className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                                <span className="max-w-[220px] truncate">{policy.name}</span>
                                <button
                                    type="button"
                                    onClick={() => setPolicy(null)}
                                    aria-label="Remove document"
                                    className="rounded p-0.5 text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-danger)]"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        ) : (
                            <span className="text-[12px] text-[var(--st-text-secondary)]">
                                Pick from your SabFiles library or upload a new file.
                            </span>
                        )}
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardBody>
                    <Textarea
                        id="notes"
                        name="notes"
                        defaultValue={float.notes ?? ''}
                        rows={4}
                        placeholder="Operating context, withdrawal rules, escalation contacts."
                    />
                </CardBody>
            </Card>

            <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--st-border)] bg-[var(--st-bg)] px-2 py-3">
                <div className="text-sm">
                    {state?.error ? (
                        <span className="text-[var(--st-danger)]">{state.error}</span>
                    ) : state?.message ? (
                        <span className="text-[var(--st-status-ok)]">{state.message}</span>
                    ) : null}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" asChild>
                        <Link href={`/dashboard/crm/petty-cash/${floatId}`}>Cancel</Link>
                    </Button>
                    <SubmitButton />
                </div>
            </div>
        </form>
    );
}
