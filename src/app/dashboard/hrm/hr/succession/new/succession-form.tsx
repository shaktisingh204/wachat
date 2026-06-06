'use client';

import { Button, Card, ZoruCardContent, Input, Label, Textarea } from '@/components/sabcrm/20ui/compat';
import {
  useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle,
  Save } from 'lucide-react';

import { saveCrmSuccessionPlan } from '@/app/actions/crm-succession.actions';

import { EntityFormField } from '@/components/crm/entity-form-field';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="gap-1">
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
        </Button>
    );
}

export function SuccessionForm({ plan }: { plan?: Record<string, any> }) {
    const [state, action] = useActionState(saveCrmSuccessionPlan as any, {
        message: '',
        error: '',
    } as any);

    const candidatesText = Array.isArray(plan?.candidates)
        ? plan!.candidates.map((c: any) => (typeof c === 'string' ? c : `${c.employeeId}|${c.readiness ?? ''}|${c.notes ?? ''}`)).join('\n')
        : '';

    return (
        <Card>
            <ZoruCardContent className="p-6">
                <form action={action} className="grid gap-4 md:grid-cols-2">
                    {plan?._id ? <input type="hidden" name="planId" value={String(plan._id)} /> : null}
                    <Field name="role" label="Role / position" defaultValue={plan?.role} required />
                    <div>
                        <Label htmlFor="incumbentEmployeeId">Incumbent employee</Label>
                        <EntityFormField
                            entity="employee"
                            name="incumbentEmployeeId"
                            initialId={plan?.incumbentEmployeeId ? String(plan.incumbentEmployeeId) : undefined}
                        />
                    </div>
                    <div>
                        <Label htmlFor="department">Department</Label>
                        <EntityFormField
                            entity="department"
                            name="department"
                            initialId={plan?.department ? String(plan.department) : undefined}
                        />
                    </div>
                    <Field name="reviewDate" label="Review date" type="date" defaultValue={plan?.reviewDate} />
                    <div className="md:col-span-2">
                        <Label htmlFor="candidates">
                            Candidates (one per line: <code>employeeId|readiness|notes</code>; readiness ∈ ready / 12mo / 24mo / long-term)
                        </Label>
                        <Textarea id="candidates" name="candidates" defaultValue={candidatesText} rows={6} />
                    </div>
                    <div className="md:col-span-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea id="notes" name="notes" defaultValue={plan?.notes ?? ''} rows={3} />
                    </div>
                    <div className="md:col-span-2 flex items-center justify-between gap-3">
                        <div className="text-sm">
                            {state?.error ? <span className="text-zoru-danger-ink">{state.error}</span> : state?.message ? <span className="text-zoru-success-ink">{state.message}</span> : null}
                        </div>
                        <SubmitButton />
                    </div>
                </form>
            </ZoruCardContent>
        </Card>
    );
}

function Field({ name, label, defaultValue, required, type = 'text' }: { name: string; label: string; defaultValue?: any; required?: boolean; type?: string }) {
    return (
        <div>
            <Label htmlFor={name}>
                {label} {required ? <span className="text-zoru-danger-ink">*</span> : null}
            </Label>
            <Input
                id={name}
                name={name}
                type={type}
                defaultValue={defaultValue ?? ''}
                required={required}
            />
        </div>
    );
}
