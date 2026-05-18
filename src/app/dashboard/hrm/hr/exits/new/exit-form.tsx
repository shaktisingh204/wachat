'use client';

import { ZoruButton, ZoruCard, ZoruCardContent, ZoruInput, ZoruLabel, ZoruTextarea } from '@/components/zoruui';
import {
  useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle,
  Save } from 'lucide-react';

import { saveExit } from '@/app/actions/crm-exits.actions';

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

export function ExitForm({ exit }: { exit?: Record<string, any> }) {
    const [state, action] = useActionState(saveExit as any, {
        message: '',
        error: '',
    } as any);

    return (
        <ZoruCard>
            <ZoruCardContent className="p-6">
                <form action={action} className="grid gap-4 md:grid-cols-2">
                    {exit?._id ? <input type="hidden" name="exitId" value={String(exit._id)} /> : null}
                    <div>
                        <ZoruLabel htmlFor="employeeId">
                            Employee <span className="text-zoru-danger-ink">*</span>
                        </ZoruLabel>
                        <EntityFormField
                            entity="employee"
                            name="employeeId"
                            dualWriteName="employeeName"
                            initialId={exit?.employeeId ? String(exit.employeeId) : undefined}
                            initialLabel={exit?.employeeName}
                            required
                        />
                    </div>
                    <Field name="type" label="Type (resignation / termination / end-of-contract)" defaultValue={exit?.type} />
                    <Field name="noticeStartDate" label="Notice start" type="date" defaultValue={exit?.noticeStartDate} />
                    <Field name="lastWorkingDay" label="Last working day" type="date" defaultValue={exit?.lastWorkingDay} />
                    <Field name="fnfStatus" label="F&F status" defaultValue={exit?.fnfStatus} />
                    <Field name="nocStatus" label="NOC status" defaultValue={exit?.nocStatus} />
                    <Field name="assetReturnStatus" label="Asset return" defaultValue={exit?.assetReturnStatus} />
                    <div className="md:col-span-2">
                        <ZoruLabel htmlFor="exitInterviewNotes">Exit interview notes</ZoruLabel>
                        <ZoruTextarea id="exitInterviewNotes" name="exitInterviewNotes" defaultValue={exit?.exitInterviewNotes ?? ''} rows={4} />
                    </div>
                    <div className="md:col-span-2">
                        <ZoruLabel htmlFor="knowledgeTransfer">Knowledge transfer</ZoruLabel>
                        <ZoruTextarea id="knowledgeTransfer" name="knowledgeTransfer" defaultValue={exit?.knowledgeTransfer ?? ''} rows={3} />
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
