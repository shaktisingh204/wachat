'use client';

import { useActionState, useEffect, useRef } from 'react';
import { handleChangePassword } from '@/app/actions/user.actions';
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
    Callout,
    Separator,
} from '@/components/sabcrm/20ui';
import { useFormStatus } from 'react-dom';
import { ShieldCheck, KeyRound, Lock } from 'lucide-react';
import { ActionResponse } from './types';

const passwordInitialState: ActionResponse = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} loading={pending} iconLeft={KeyRound}>
            Update password
        </Button>
    );
}

export function PasswordForm() {
    const [state, formAction] = useActionState(handleChangePassword, passwordInitialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Success!', description: state.message });
            formRef.current?.reset();
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    return (
        <form action={formAction} ref={formRef}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ShieldCheck size={16} aria-hidden="true" />
                    Change password
                </CardTitle>
                <CardDescription>Update the credentials you use to sign in.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
                <Callout tone="info" title="Keep it strong">
                    Use at least 8 characters with a mix of letters, numbers and symbols.
                </Callout>
                <Field label="Current password" required>
                    <Input
                        name="currentPassword"
                        type="password"
                        autoComplete="current-password"
                        iconLeft={Lock}
                    />
                </Field>
                <Separator />
                <Field label="New password" required>
                    <Input
                        name="newPassword"
                        type="password"
                        autoComplete="new-password"
                        iconLeft={KeyRound}
                    />
                </Field>
                <Field label="Confirm new password" required>
                    <Input
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        iconLeft={KeyRound}
                    />
                </Field>
            </CardBody>
            <CardFooter>
                <SubmitButton />
            </CardFooter>
        </form>
    );
}
