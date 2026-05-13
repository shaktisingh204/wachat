'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Save } from 'lucide-react';

import { updatePortalUser } from '@/app/actions/crm-portal.actions';
import {
    ZoruButton,
    ZoruCard,
    ZoruCardContent,
    ZoruInput,
    ZoruLabel,
} from '@/components/zoruui';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending} className="gap-1">
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
        </ZoruButton>
    );
}

export function PortalEditForm({ user }: { user: Record<string, any> }) {
    const [state, action] = useActionState(updatePortalUser as any, {
        message: '',
        error: '',
    } as any);

    return (
        <ZoruCard>
            <ZoruCardContent className="p-6">
                <form action={action} className="grid gap-4 md:grid-cols-2">
                    <input type="hidden" name="userId" value={String(user._id ?? '')} />
                    <Field name="name" label="Name" defaultValue={user.name} required />
                    <Field name="email" label="Email" defaultValue={user.email} type="email" />
                    <Field name="phone" label="Phone" defaultValue={user.phone} />
                    <Field name="portalType" label="Portal type" defaultValue={user.portalType} />
                    <Field name="capabilities" label="Capabilities (comma-sep)" defaultValue={Array.isArray(user.capabilities) ? user.capabilities.join(', ') : user.capabilities ?? ''} />
                    <Field name="status" label="Status" defaultValue={user.status} />
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
