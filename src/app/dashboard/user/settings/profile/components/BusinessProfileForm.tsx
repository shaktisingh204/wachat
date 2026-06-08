'use client';

import { useActionState, useEffect } from 'react';
import { handleUpdateUserProfile } from '@/app/actions/user.actions';
import { useToast } from '@/hooks/use-toast';
import {
    CardBody,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    Field,
    Input,
    Textarea,
    Button,
} from '@/components/sabcrm/20ui';
import { useFormStatus } from 'react-dom';
import { Save, LoaderCircle, Building2 } from 'lucide-react';
import { UserProfileFormProps, ActionResponse } from './types';

const profileInitialState: ActionResponse = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    const Icon = pending ? LoaderCircle : Save;
    return (
        <Button type="submit" disabled={pending} aria-busy={pending}>
            <Icon size={16} aria-hidden="true" className={pending ? 'animate-spin' : undefined} />
            {pending ? 'Saving…' : 'Save business profile'}
        </Button>
    );
}

export function BusinessProfileForm({ user }: UserProfileFormProps) {
    const [state, formAction] = useActionState(handleUpdateUserProfile, profileInitialState);
    const { toast } = useToast();

    useEffect(() => {
        if (state?.message) toast({ title: 'Success!', description: state.message });
        if (state?.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);

    return (
        <form action={formAction}>
            <input type="hidden" name="name" value={user.name} />
            <input type="hidden" name="tags" value={JSON.stringify(user.tags || [])} />
            <input type="hidden" name="appRailPosition" value={user.appRailPosition || 'left'} />

            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <span
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-[var(--st-radius)] bg-[color-mix(in_srgb,var(--st-success)_14%,transparent)] text-[var(--st-success)]"
                        aria-hidden="true"
                    >
                        <Building2 size={15} />
                    </span>
                    Business profile
                </CardTitle>
                <CardDescription>Used on invoices, vouchers, and accounting documents.</CardDescription>
            </CardHeader>
            <CardBody className="grid gap-4 md:grid-cols-2">
                <Field label="Business name">
                    <Input name="businessName" defaultValue={user.businessProfile?.name} />
                </Field>
                <Field label="GSTIN">
                    <Input name="businessGstin" defaultValue={user.businessProfile?.gstin} />
                </Field>
                <Field label="Address" className="md:col-span-2">
                    <Textarea name="businessAddress" defaultValue={user.businessProfile?.address} />
                </Field>
            </CardBody>
            <CardFooter className="justify-end">
                <SubmitButton />
            </CardFooter>
        </form>
    );
}
