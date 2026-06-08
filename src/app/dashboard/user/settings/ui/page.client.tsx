'use client';

import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardBody,
    CardFooter,
    Separator,
    EmptyState,
    Button,
} from '@/components/sabcrm/20ui';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { handleUpdateUserProfile, getSession } from '@/app/actions/user.actions';
import type { User } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle } from 'lucide-react';

import { SubmitButton } from './components/SubmitButton';
import { UIPageSkeleton } from './components/UIPageSkeleton';
import { AppRailSettings } from './components/AppRailSettings';
import { LanguageSettings } from './components/LanguageSettings';

interface UpdateProfileActionState {
    message?: string;
    error?: string;
}

const initialState: UpdateProfileActionState = { message: undefined, error: undefined };

export default function UiPreferencesPage() {
    const [user, setUser] = useState<Omit<User, 'password'> | null>(null);
    const [loading, setLoading] = useState(true);
    const [state, formAction] = useActionState<UpdateProfileActionState, FormData>(
        handleUpdateUserProfile,
        initialState,
    );
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        document.title = 'UI Preferences | SabNode';
        let isMounted = true;
        getSession()
            .then((session) => {
                if (!isMounted) return;
                if (session?.user) setUser(session.user);
                setLoading(false);
            })
            .catch((err) => {
                console.error('Failed to fetch session:', err);
                if (isMounted) setLoading(false);
            });
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.refresh();
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    if (loading) {
        return <UIPageSkeleton />;
    }

    if (!user) {
        return (
            <EmptyState
                icon={AlertCircle}
                title="Could not load preferences"
                description="Your session may have expired. Please refresh the page or sign in again."
                action={<Button onClick={() => router.refresh()}>Refresh</Button>}
            />
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Settings</PageEyebrow>
                    <PageTitle>UI Preferences</PageTitle>
                    <PageDescription>Customize the look and feel of your dashboard.</PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <form action={formAction}>
                {/* Preserve the user's name so it is not erased on save. */}
                <input type="hidden" name="name" value={user.name || ''} />
                <Card>
                    <CardHeader>
                        <CardTitle>Appearance</CardTitle>
                        <CardDescription>Navigation layout and dashboard language.</CardDescription>
                    </CardHeader>
                    <CardBody className="space-y-6">
                        <AppRailSettings currentPosition={user.appRailPosition} />
                        <Separator />
                        <LanguageSettings currentLanguage={user.language} />
                    </CardBody>
                    <CardFooter>
                        <SubmitButton />
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}
