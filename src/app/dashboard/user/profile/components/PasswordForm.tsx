'use client';

import { useActionState, useEffect, useRef } from 'react';
import { handleChangePassword } from '@/app/actions/user.actions';
import { useToast } from '@/hooks/use-toast';
import {
    ZoruCardContent,
    ZoruCardDescription,
    ZoruCardFooter,
    ZoruCardHeader,
    ZoruCardTitle,
    Input,
    Label,
    Button,
    Separator,
} from '@/components/sabcrm/20ui/compat';
import { KeyRound, LoaderCircle } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { ActionResponse } from './types';

const passwordInitialState: ActionResponse = { message: undefined, error: undefined };

function SubmitButton({ children, icon: Icon }: { children: React.ReactNode; icon: React.ElementType }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
            {children}
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
            <ZoruCardHeader>
                <ZoruCardTitle>Change Password</ZoruCardTitle>
                <ZoruCardDescription>Enter your current and new password to update your credentials.</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
                </div>
                <Separator />
                <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input id="newPassword" name="newPassword" type="password" required autoComplete="new-password" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" />
                </div>
            </ZoruCardContent>
            <ZoruCardFooter>
                <SubmitButton icon={KeyRound}>Update Password</SubmitButton>
            </ZoruCardFooter>
        </form>
    );
}
