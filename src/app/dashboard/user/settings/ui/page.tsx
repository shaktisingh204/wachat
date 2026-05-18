
'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ZoruCard, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, ZoruCardContent, ZoruCardFooter, ZoruButton } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { ZoruRadioGroup, ZoruRadioGroupItem } from '@/components/zoruui';
import { handleUpdateUserProfile, getSession } from '@/app/actions/user.actions';
import type { User } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, Save } from 'lucide-react';
import { ZoruSkeleton } from '@/components/zoruui';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Preferences
        </ZoruButton>
    )
}

function UIPageSkeleton() {
    return (
        <ZoruCard>
            <ZoruCardHeader><ZoruSkeleton className="h-6 w-1/3" /><ZoruSkeleton className="h-4 w-2/3 mt-2" /></ZoruCardHeader>
            <ZoruCardContent><ZoruSkeleton className="h-24 w-full" /></ZoruCardContent>
            <ZoruCardFooter><ZoruSkeleton className="h-10 w-32" /></ZoruCardFooter>
        </ZoruCard>
    );
}

export default function UiPreferencesPage() {
    const [user, setUser] = useState<(Omit<User, 'password'>) | null>(null);
    const [loading, setLoading] = useState(true);
    const [state, formAction] = useActionState(handleUpdateUserProfile, initialState);
    const { toast } = useToast();

    useEffect(() => {
        getSession().then(session => {
            if (session?.user) {
                setUser(session.user);
            }
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            // Potentially force a reload or use context to update layout instantly
            window.location.reload();
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    if (loading) {
        return <UIPageSkeleton />;
    }

    if (!user) {
        return <UIPageSkeleton />;
    }

    return (
        <form action={formAction}>
            {/* Pass user's name so it doesn't get erased on save */}
            <input type="hidden" name="name" value={user.name} />
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>UI Preferences</ZoruCardTitle>
                    <ZoruCardDescription>Customize the look and feel of your dashboard.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    <div className="space-y-2">
                        <ZoruLabel>App Rail Position</ZoruLabel>
                        <p className="text-sm text-muted-foreground">Choose where the main application navigation bar appears.</p>
                        <ZoruRadioGroup
                            name="appRailPosition"
                            defaultValue={user.appRailPosition || 'left'}
                            className="flex gap-4 pt-2"
                        >
                            <div className="flex items-center space-x-2">
                                <ZoruRadioGroupItem value="left" id="pos-left" />
                                <ZoruLabel htmlFor="pos-left" className="font-normal">Left Sidebar</ZoruLabel>
                            </div>
                            <div className="flex items-center space-x-2">
                                <ZoruRadioGroupItem value="top" id="pos-top" />
                                <ZoruLabel htmlFor="pos-top" className="font-normal">Top Header</ZoruLabel>
                            </div>
                        </ZoruRadioGroup>
                    </div>
                </ZoruCardContent>
                <ZoruCardFooter>
                    <SubmitButton />
                </ZoruCardFooter>
            </ZoruCard>
        </form>
    );
}
