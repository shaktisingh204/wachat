'use client';

import { ZoruButton, ZoruCard, ZoruCardContent, ZoruInput, ZoruLabel, ZoruTextarea } from '@/components/zoruui';
import {
  useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle,
  Save } from 'lucide-react';

import { updatePettyCashFloat } from '@/app/actions/crm-petty-cash.actions';

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

export function PettyCashEditForm({ float }: { float: Record<string, any> }) {
    const [state, action] = useActionState(updatePettyCashFloat as any, {
        message: '',
        error: '',
    } as any);

    return (
        <ZoruCard>
            <ZoruCardContent className="p-6">
                <form action={action} className="grid gap-4 md:grid-cols-2">
                    <input type="hidden" name="floatId" value={String(float._id ?? '')} />
                    <Field name="name" label="Name" defaultValue={float.name} required />
                    <div>
                        <ZoruLabel>Branch</ZoruLabel>
                        <EntityFormField
                            entity="branch"
                            name="branchId"
                            dualWriteName="branchName"
                            initialId={float.branchId ?? null}
                            initialLabel={float.branchName ?? ''}
                            placeholder="Select branch…"
                        />
                    </div>
                    <div>
                        <ZoruLabel>Custodian</ZoruLabel>
                        <EntityFormField
                            entity="employee"
                            name="custodianId"
                            dualWriteName="custodianName"
                            initialId={float.custodianId ?? null}
                            initialLabel={float.custodianName ?? ''}
                            placeholder="Select custodian…"
                        />
                    </div>
                    <Field name="openingBalance" label="Opening balance" type="number" defaultValue={float.openingBalance} />
                    <Field name="currentBalance" label="Current balance" type="number" defaultValue={float.currentBalance} />
                    <Field name="currency" label="Currency" defaultValue={float.currency} />
                    <div className="md:col-span-2">
                        <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                        <ZoruTextarea id="notes" name="notes" defaultValue={float.notes ?? ''} rows={3} />
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
