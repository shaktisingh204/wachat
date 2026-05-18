'use client';

import { ZoruButton, ZoruCard, ZoruCardContent, ZoruInput, ZoruLabel, ZoruTextarea } from '@/components/zoruui';
import {
  useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle,
  Save } from 'lucide-react';

import { updateServiceContract } from '@/app/actions/crm-service-contracts.actions';

import { EntityFormField } from '@/components/crm/entity-form-field';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending} className="gap-1">
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
        </ZoruButton>
    );
}

export function ServiceContractEditForm({ contract }: { contract: Record<string, any> }) {
    const [state, action] = useActionState(updateServiceContract as any, {
        message: '',
        error: '',
    } as any);

    return (
        <ZoruCard>
            <ZoruCardContent className="p-6">
                <form action={action} className="grid gap-4 md:grid-cols-2">
                    <input type="hidden" name="contractId" value={String(contract._id ?? '')} />
                    <Field name="contractNo" label="Contract no." defaultValue={contract.contractNo} />
                    <div>
                        <ZoruLabel>Customer</ZoruLabel>
                        <EntityFormField
                            entity="client"
                            name="customerId"
                            dualWriteName="customerName"
                            initialId={contract.customerId ?? null}
                            initialLabel={contract.customerName ?? ''}
                            placeholder="Select customer…"
                        />
                    </div>
                    <Field name="coverage" label="Coverage" defaultValue={contract.coverage} />
                    <Field name="frequency" label="Frequency" defaultValue={contract.frequency} />
                    <Field name="startDate" label="Start date" type="date" defaultValue={contract.startDate} />
                    <Field name="endDate" label="End date" type="date" defaultValue={contract.endDate} />
                    <div>
                        <ZoruLabel>Technician</ZoruLabel>
                        <EntityFormField
                            entity="employee"
                            name="technicianId"
                            dualWriteName="technician"
                            initialId={contract.technicianId ?? null}
                            initialLabel={contract.technician ?? ''}
                            placeholder="Select technician…"
                        />
                    </div>
                    <Field name="billing" label="Billing" defaultValue={contract.billing} />
                    <Field name="status" label="Status" defaultValue={contract.status} />
                    <div className="md:col-span-2">
                        <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                        <ZoruTextarea id="notes" name="notes" defaultValue={contract.notes ?? ''} rows={3} />
                    </div>
                    <div className="md:col-span-2 flex items-center justify-between gap-3">
                        <div className="text-sm">
                            {state?.error ? <span className="text-zoru-danger-ink">{state.error}</span> : state?.message ? <span className="text-zoru-success-ink">{state.message}</span> : null}
                        </div>
                        <SubmitButton />
                    </div>
                </form>
            </ZoruCardContent>
        </ZoruCard>
    );
}

function Field({ name, label, defaultValue, required, type = 'text' }: { name: string; label: string; defaultValue?: any; required?: boolean; type?: string }) {
    return (
        <div>
            <ZoruLabel htmlFor={name}>
                {label} {required ? <span className="text-zoru-danger-ink">*</span> : null}
            </ZoruLabel>
            <ZoruInput
                id={name}
                name={name}
                type={type}
                defaultValue={defaultValue ?? ''}
                required={required}
            />
        </div>
    );
}
