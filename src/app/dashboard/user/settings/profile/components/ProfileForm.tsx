'use client';

import { useActionState, useEffect } from 'react';
import { handleUpdateUserProfile } from '@/app/actions/user.actions';
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
} from '@/components/zoruui';
import { Save, LoaderCircle } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { UserProfileFormProps, ActionResponse } from './types';

const profileInitialState: ActionResponse = { message: undefined, error: undefined };

function SubmitButton({ children, icon: Icon }: { children: React.ReactNode; icon: React.ElementType }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
            {children}
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

            <ZoruCardHeader>
                <ZoruCardTitle>User Profile</ZoruCardTitle>
                <ZoruCardDescription>Manage your name and view your account details.</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input 
                        id="name" 
                        name="name" 
                        defaultValue={user.name} 
                        required 
                        maxLength={50} 
                        pattern="^[a-zA-Z\s'-]+$" 
                        title="Name can only contain letters, spaces, apostrophes, and hyphens." 
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" value={user.email} disabled />
                </div>
                <div className="space-y-2">
                    <Label>Account Created</Label>
                    <Input value={formattedCreatedAt} disabled />
                </div>
            </ZoruCardContent>
            <ZoruCardFooter>
                <SubmitButton icon={Save}>Save Changes</SubmitButton>
            </ZoruCardFooter>
        </form>
    );
}
