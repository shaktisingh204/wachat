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
    Button,
} from '@/components/sabcrm/20ui';
import { useFormStatus } from 'react-dom';
import { Save, LoaderCircle } from 'lucide-react';
import { UserProfileFormProps, ActionResponse } from './types';

const profileInitialState: ActionResponse = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    const Icon = pending ? LoaderCircle : Save;
    return (
        <Button type="submit" disabled={pending}>
            <Icon size={16} aria-hidden="true" className={pending ? 'animate-spin' : undefined} />
            Save changes
        </Button>
    );
}

export function ProfileForm({ user }: UserProfileFormProps) {
    const [state, formAction] = useActionState(handleUpdateUserProfile, profileInitialState);
    const { toast } = useToast();

    useEffect(() => {
        if (state?.message) toast({ title: 'Success!', description: state.message });
        if (state?.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);

    const formattedCreatedAt = new Date(user.createdAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });

    return (
        <form action={formAction}>
            <input type="hidden" name="tags" value={JSON.stringify(user.tags || [])} />
            <input type="hidden" name="appRailPosition" value={user.appRailPosition || 'left'} />
            <input type="hidden" name="businessName" value={user.businessProfile?.name || ''} />
            <input type="hidden" name="businessAddress" value={user.businessProfile?.address || ''} />
            <input type="hidden" name="businessGstin" value={user.businessProfile?.gstin || ''} />

            <CardHeader>
                <CardTitle>Personal details</CardTitle>
                <CardDescription>Your name and account information.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
                <Field label="Full name" required>
                    <Input
                        name="name"
                        defaultValue={user.name}
                        maxLength={50}
                        pattern="^[a-zA-Z\s'-]+$"
                        title="Name can only contain letters, spaces, apostrophes, and hyphens."
                    />
                </Field>
                <Field label="Email" help="Your sign-in email cannot be changed here.">
                    <Input name="email" value={user.email} disabled />
                </Field>
                <Field label="Account created">
                    <Input value={formattedCreatedAt} disabled />
                </Field>
            </CardBody>
            <CardFooter>
                <SubmitButton />
            </CardFooter>
        </form>
    );
}
