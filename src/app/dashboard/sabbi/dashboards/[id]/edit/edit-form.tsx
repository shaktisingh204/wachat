'use client';

import { Button, Card, CardBody, Input, Label, Textarea } from '@/components/sabcrm/20ui';
import {
  useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle,
  Save } from 'lucide-react';

import { updateDashboard } from '@/app/actions/crm-dashboards.actions';

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

export function DashboardEditForm({ dashboard }: { dashboard: Record<string, any> }) {
    const [state, action] = useActionState(updateDashboard as any, {
        message: '',
        error: '',
    } as any);

    return (
        <Card>
            <CardBody className="p-6">
                <form action={action} className="grid gap-4 md:grid-cols-2">
                    <input type="hidden" name="dashboardId" value={String(dashboard._id ?? '')} />
                    <Field name="name" label="Name" defaultValue={dashboard.name} required />
                    <Field name="layout" label="Layout" defaultValue={dashboard.layout} />
                    <Field name="visibility" label="Visibility" defaultValue={dashboard.visibility} />
                    <Field name="autoRefreshSeconds" label="Auto-refresh (sec)" type="number" defaultValue={dashboard.autoRefreshSeconds} />
                    <div>
                        <Label>Owner</Label>
                        <EntityFormField
                            entity="user"
                            name="ownerId"
                            initialId={dashboard.ownerId ?? null}
                            placeholder="Select owner…"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" name="description" defaultValue={dashboard.description ?? ''} rows={3} />
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
