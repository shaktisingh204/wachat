'use client';

import { Button, Card, CardBody, Input, Label, Textarea } from '@/components/sabcrm/20ui';
import {
  useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle,
  Save } from 'lucide-react';

import { saveHolidayAction } from '@/app/actions/crm/holidays.actions';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="gap-1">
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
        </Button>
    );
}

export function HolidayForm({ holiday }: { holiday?: Record<string, any> }) {
    const [state, action] = useActionState(saveHolidayAction as any, {
        message: '',
        error: '',
    } as any);

    const locations = Array.isArray(holiday?.applicableLocations)
        ? holiday!.applicableLocations.join(', ')
        : (holiday?.applicableLocations ?? '');

    return (
        <Card>
            <CardBody className="p-6">
                <form action={action} className="grid gap-4 md:grid-cols-2">
                    {holiday?._id ? <input type="hidden" name="holidayId" value={String(holiday._id)} /> : null}
                    <Field name="date" label="Date" type="date" defaultValue={holiday?.date} required />
                    <Field name="name" label="Name" defaultValue={holiday?.name} required />
                    <Field name="type" label="Type (national / regional / religious / optional / restricted)" defaultValue={holiday?.type} />
                    <div className="flex items-center gap-2">
                        <input
                            id="recurring"
                            name="recurring"
                            type="checkbox"
                            defaultChecked={Boolean(holiday?.recurring)}
                        />
                        <Label htmlFor="recurring">Recurring</Label>
                    </div>
                    <Field name="applicableLocations" label="Applicable locations (comma-sep)" defaultValue={locations} />
                    <div className="md:col-span-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea id="notes" name="notes" defaultValue={holiday?.notes ?? ''} rows={3} />
                    </div>
                    <div className="md:col-span-2 flex items-center justify-between gap-3">
                        <div className="text-sm">
                            {state?.error ? <span className="text-[var(--st-danger)]">{state.error}</span> : state?.message ? <span className="text-[var(--st-status-ok)]">{state.message}</span> : null}
                        </div>
                        <SubmitButton />
                    </div>
                </form>
            </CardBody>
        </Card>
    );
}

function Field({ name, label, defaultValue, required, type = 'text' }: { name: string; label: string; defaultValue?: any; required?: boolean; type?: string }) {
    return (
        <div>
            <Label htmlFor={name}>
                {label} {required ? <span className="text-[var(--st-danger)]">*</span> : null}
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
