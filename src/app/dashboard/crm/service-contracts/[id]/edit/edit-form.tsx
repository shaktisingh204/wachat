'use client';

/**
 * <ServiceContractEditForm> — deepened edit form per
 * CRM_PAGE_REDESIGN_PLAN §3.3.2.
 *
 * Sectioned cards (no tabs — has no tab primitive):
 *   1. Identification — contract no., title, coverage, frequency,
 *      status
 *   2. Parties — customer (account), counterparty contact, assigned
 *      technician (employee), assigned account manager (user)
 *   3. Period & billing — start/end date, value, billing cadence,
 *      currency
 *   4. Renewal — auto-renew flag, renewal notice days, next renewal
 *      date
 *   5. Terms & conditions — textarea (rich text not available in
 *      )
 *   6. Document attachments — up to 8 SabFiles picks (signed PDF,
 *      annexures, etc.)
 *   7. Notes
 *
 * Backward compatible: extra fields are written when present; legacy
 * documents without them load fine.
 */

import * as React from 'react';
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Switch, Textarea } from '@/components/sabcrm/20ui';
import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { FileText, LoaderCircle, Plus, Save, X } from 'lucide-react';
import Link from 'next/link';

import { updateServiceContract } from '@/app/actions/crm-service-contracts.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

type ContractStatus = 'draft' | 'active' | 'paused' | 'closed' | 'expired';

interface ServiceContract {
    _id?: string;
    contractNo?: string;
    title?: string;
    customerId?: string;
    customerName?: string;
    contactId?: string;
    contactName?: string;
    technicianId?: string;
    technician?: string;
    accountManagerId?: string;
    accountManagerName?: string;
    coverage?: string;
    frequency?: string;
    periodStart?: string;
    periodEnd?: string;
    startDate?: string;
    endDate?: string;
    billingAmount?: number;
    billing?: string;
    currency?: string;
    autoRenew?: boolean;
    renewalNoticeDays?: number;
    nextRenewalAt?: string;
    terms?: string;
    notes?: string;
    status?: ContractStatus;
    documents?: Array<{
        id: string;
        url?: string;
        name?: string;
    }>;
}

const STATUS_OPTIONS: ReadonlyArray<{ value: ContractStatus; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'closed', label: 'Closed' },
    { value: 'expired', label: 'Expired' },
];

const MAX_DOCS = 8;

function toDateInput(value?: string): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

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

export function ServiceContractEditForm({
    contract,
}: {
    contract: ServiceContract;
}) {
    const [state, action] = useActionState(
        updateServiceContract as unknown as (
            prev: { message?: string; error?: string },
            fd: FormData,
        ) => Promise<{ message?: string; error?: string }>,
        { message: '', error: '' },
    );

    const contractId = String(contract._id ?? '');
    const [status, setStatus] = React.useState<ContractStatus>(
        (contract.status as ContractStatus) ?? 'active',
    );
    const [autoRenew, setAutoRenew] = React.useState<boolean>(
        Boolean(contract.autoRenew),
    );
    const [documents, setDocuments] = React.useState<SabFilePick[]>(() => {
        const list = Array.isArray(contract.documents) ? contract.documents : [];
        return list
            .filter((d) => d && typeof d.id === 'string')
            .map((d) => ({ id: d.id, url: d.url ?? '', name: d.name ?? 'document' }));
    });

    useEffect(() => {
        if (state?.message) {
            window.location.href = `/dashboard/crm/service-contracts/${contractId}`;
        }
    }, [state, contractId]);

    function addDocument(pick: SabFilePick): void {
        setDocuments((prev) => {
            if (prev.some((p) => p.id === pick.id)) return prev;
            if (prev.length >= MAX_DOCS) return prev;
            return [...prev, pick];
        });
    }

    function removeDocument(id: string): void {
        setDocuments((prev) => prev.filter((p) => p.id !== id));
    }

    const startInitial = toDateInput(contract.periodStart ?? contract.startDate);
    const endInitial = toDateInput(contract.periodEnd ?? contract.endDate);

    return (
        <form action={action} className="space-y-6">
            <input type="hidden" name="id" value={contractId} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="autoRenew" value={autoRenew ? 'true' : 'false'} />
            <input
                type="hidden"
                name="documents"
                value={JSON.stringify(documents)}
            />

            <Card>
                <CardHeader>
                    <CardTitle>Identification</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="contractNo">
                                Contract no.{' '}
                                <span className="text-[var(--st-danger)]">*</span>
                            </Label>
                            <Input
                                id="contractNo"
                                name="contractNo"
                                defaultValue={contract.contractNo ?? ''}
                                required
                                minLength={2}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                name="title"
                                defaultValue={contract.title ?? ''}
                                placeholder="Annual maintenance — HVAC system"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="coverage">Coverage</Label>
                            <Input
                                id="coverage"
                                name="coverage"
                                defaultValue={contract.coverage ?? ''}
                                placeholder="On-site, 9×5"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="frequency">Visit frequency</Label>
                            <Input
                                id="frequency"
                                name="frequency"
                                defaultValue={contract.frequency ?? ''}
                                placeholder="Monthly"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>Status</Label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as ContractStatus)}
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
                    <CardTitle>Parties</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Customer</Label>
                            <EntityFormField
                                entity="client"
                                name="customerId"
                                dualWriteName="customerName"
                                initialId={contract.customerId ?? null}
                                initialLabel={contract.customerName ?? ''}
                                placeholder="Select customer…"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Primary contact</Label>
                            <EntityFormField
                                entity="contact"
                                name="contactId"
                                dualWriteName="contactName"
                                initialId={contract.contactId ?? null}
                                initialLabel={contract.contactName ?? ''}
                                placeholder="Select contact…"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Assigned technician</Label>
                            <EntityFormField
                                entity="employee"
                                name="technicianId"
                                dualWriteName="technician"
                                initialId={contract.technicianId ?? null}
                                initialLabel={contract.technician ?? ''}
                                placeholder="Select technician…"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Account manager</Label>
                            <EntityFormField
                                entity="user"
                                name="accountManagerId"
                                dualWriteName="accountManagerName"
                                initialId={contract.accountManagerId ?? null}
                                initialLabel={contract.accountManagerName ?? ''}
                                placeholder="Select manager…"
                            />
                        </div>
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Period & billing</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="periodStart">Start date</Label>
                            <Input
                                id="periodStart"
                                name="periodStart"
                                type="date"
                                defaultValue={startInitial}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="periodEnd">End date</Label>
                            <Input
                                id="periodEnd"
                                name="periodEnd"
                                type="date"
                                defaultValue={endInitial}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="billingAmount">Contract value</Label>
                            <Input
                                id="billingAmount"
                                name="billingAmount"
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={contract.billingAmount ?? 0}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="billing">Billing cadence</Label>
                            <Input
                                id="billing"
                                name="billing"
                                defaultValue={contract.billing ?? ''}
                                placeholder="Monthly / Quarterly / Annual"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="currency">Currency</Label>
                            <Input
                                id="currency"
                                name="currency"
                                defaultValue={contract.currency ?? 'INR'}
                                maxLength={6}
                            />
                        </div>
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Renewal</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="flex items-center justify-between rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)]/40 px-3 py-2">
                        <div className="text-[12.5px] text-[var(--st-text)]">
                            <div className="font-medium">Auto-renew</div>
                            <div className="text-[var(--st-text-secondary)]">
                                Automatically renew the contract at expiry.
                            </div>
                        </div>
                        <Switch
                            checked={autoRenew}
                            onCheckedChange={(v) => setAutoRenew(Boolean(v))}
                            aria-label="Auto-renew"
                        />
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="renewalNoticeDays">
                                Renewal notice (days)
                            </Label>
                            <Input
                                id="renewalNoticeDays"
                                name="renewalNoticeDays"
                                type="number"
                                min="0"
                                max="365"
                                defaultValue={contract.renewalNoticeDays ?? 30}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nextRenewalAt">Next renewal date</Label>
                            <Input
                                id="nextRenewalAt"
                                name="nextRenewalAt"
                                type="date"
                                defaultValue={toDateInput(contract.nextRenewalAt)}
                            />
                        </div>
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Terms & conditions</CardTitle>
                </CardHeader>
                <CardBody>
                    <Textarea
                        id="terms"
                        name="terms"
                        defaultValue={contract.terms ?? ''}
                        rows={8}
                        placeholder="Scope of work, exclusions, SLAs, payment terms…"
                    />
                    <p className="mt-1 text-[11px] text-[var(--st-text-secondary)]">
                        Plain text — rich-text editor not available in this build.
                    </p>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Document attachments</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="space-y-2">
                        {documents.length === 0 ? (
                            <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                                No documents attached yet.
                            </p>
                        ) : (
                            <ul className="space-y-1.5">
                                {documents.map((doc) => (
                                    <li
                                        key={doc.id}
                                        className="flex items-center justify-between gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-2.5 py-1.5 text-[12.5px]"
                                    >
                                        <span className="inline-flex min-w-0 items-center gap-2 text-[var(--st-text)]">
                                            <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-secondary)]" />
                                            <span className="truncate">{doc.name}</span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeDocument(doc.id)}
                                            aria-label={`Remove ${doc.name}`}
                                            className="shrink-0 rounded p-1 text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-danger)]"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="flex items-center gap-2">
                            <SabFilePickerButton
                                accept="document"
                                onPick={(pick) => addDocument(pick)}
                            >
                                <Plus className="h-4 w-4" />
                                Add document
                            </SabFilePickerButton>
                            <span className="text-[11px] text-[var(--st-text-secondary)]">
                                {documents.length}/{MAX_DOCS} attached
                            </span>
                        </div>
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
                        defaultValue={contract.notes ?? ''}
                        rows={4}
                        placeholder="Internal notes about this contract."
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
                        <Link href={`/dashboard/crm/service-contracts/${contractId}`}>
                            Cancel
                        </Link>
                    </Button>
                    <SubmitButton />
                </div>
            </div>
        </form>
    );
}
