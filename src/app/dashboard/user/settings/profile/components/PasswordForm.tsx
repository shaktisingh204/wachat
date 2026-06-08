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
    Separator,
} from '@/components/sabcrm/20ui';
import { useFormStatus } from 'react-dom';
import { KeyRound, LoaderCircle, Lock } from 'lucide-react';
import { ActionResponse } from './types';

const passwordInitialState: ActionResponse = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    const Icon = pending ? LoaderCircle : KeyRound;
    return (
        <Button type="submit" disabled={pending} aria-busy={pending}>
            <Icon size={16} aria-hidden="true" className={pending ? 'animate-spin' : undefined} />
            {pending ? 'Updating…' : 'Update password'}
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
                    <span
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-[var(--st-radius)] bg-[color-mix(in_srgb,var(--st-warn)_14%,transparent)] text-[var(--st-warn)]"
                        aria-hidden="true"
                    >
                        <Lock size={15} />
                    </span>
                    Change password
                </CardTitle>
                <CardDescription>Enter your current and new password to update your credentials.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
                <Field label="Current password" required>
                    <Input name="currentPassword" type="password" autoComplete="current-password" />
                </Field>
                <Separator />
                <Field label="New password" required>
                    <Input name="newPassword" type="password" autoComplete="new-password" />
                </Field>
                <Field label="Confirm new password" required>
                    <Input name="confirmPassword" type="password" autoComplete="new-password" />
                </Field>
            </CardBody>
            <CardFooter className="justify-end">
                <SubmitButton />
            </CardFooter>
        </form>
    );
}
