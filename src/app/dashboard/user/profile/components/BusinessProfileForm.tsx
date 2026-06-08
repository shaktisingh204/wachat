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
import { Save, Building2, ReceiptText } from 'lucide-react';
import { UserProfileFormProps, ActionResponse } from './types';

const profileInitialState: ActionResponse = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} loading={pending} iconLeft={Save}>
            Save business profile
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
            <input type="hidden" name="language" value={user.language || 'en'} />

            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Building2 size={16} aria-hidden="true" />
                    Business profile
                </CardTitle>
                <CardDescription>Used on invoices, vouchers and accounting documents.</CardDescription>
            </CardHeader>
            <CardBody className="grid gap-4 md:grid-cols-2">
                <Field label="Business name">
                    <Input name="businessName" defaultValue={user.businessProfile?.name} iconLeft={Building2} />
                </Field>
                <Field label="GSTIN">
                    <Input name="businessGstin" defaultValue={user.businessProfile?.gstin} iconLeft={ReceiptText} />
                </Field>
                <Field label="PAN">
                    <Input name="businessPan" defaultValue={user.businessProfile?.pan} />
                </Field>
                <Field label="Address" className="md:col-span-2">
                    <Textarea name="businessAddress" defaultValue={user.businessProfile?.address} />
                </Field>
            </CardBody>
            <CardFooter>
                <SubmitButton />
            </CardFooter>
        </form>
    );
}
