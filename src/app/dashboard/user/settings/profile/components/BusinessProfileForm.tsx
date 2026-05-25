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
    Textarea,
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

            <ZoruCardHeader>
                <ZoruCardTitle>Business Profile</ZoruCardTitle>
                <ZoruCardDescription>This information will be used in invoices, vouchers, and other accounting documents.</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name</Label>
                    <Input id="businessName" name="businessName" defaultValue={user.businessProfile?.name} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="businessAddress">Address</Label>
                    <Textarea id="businessAddress" name="businessAddress" defaultValue={user.businessProfile?.address} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="businessGstin">GSTIN</Label>
                    <Input id="businessGstin" name="businessGstin" defaultValue={user.businessProfile?.gstin} />
                </div>
            </ZoruCardContent>
            <ZoruCardFooter>
                <SubmitButton icon={Save}>Save Business Profile</SubmitButton>
            </ZoruCardFooter>
        </form>
    );
}
