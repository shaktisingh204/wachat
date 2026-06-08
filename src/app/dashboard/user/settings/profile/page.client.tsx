'use client';

import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    Card,
    EmptyState,
    Button,
} from '@/components/sabcrm/20ui';
import { useEffect, useState } from 'react';
import { getSession } from '@/app/actions/user.actions';
import type { User } from '@/lib/definitions';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

import { ProfileForm } from './components/ProfileForm';
import { BusinessProfileForm } from './components/BusinessProfileForm';
import { PasswordForm } from './components/PasswordForm';
import { OnboardingDetailsCard } from './components/OnboardingDetailsCard';
import { ProfilePageSkeleton } from './components/ProfilePageSkeleton';

export default function ProfilePage() {
    const [user, setUser] = useState<Omit<User, 'password'> | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        document.title = 'Profile | SabNode';
        getSession().then((session) => {
            if (session?.user) setUser(session.user);
            setLoading(false);
        });
    }, []);

    if (loading) {
        return <ProfilePageSkeleton />;
    }

    if (!user) {
        return (
            <EmptyState
                icon={AlertCircle}
                title="Could not load your profile"
                description="Your session may have expired. Please sign in again to continue."
                action={
                    <Button asChild>
                        <Link href="/login">Sign in</Link>
                    </Button>
                }
            />
        );
    }

    return (
        <div className="flex max-w-[960px] flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Settings</PageEyebrow>
                    <PageTitle>Profile</PageTitle>
                    <PageDescription>Manage your personal details, business profile, and password.</PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <div className="grid items-start gap-5 lg:grid-cols-2">
                <Card>
                    <ProfileForm user={user} />
                </Card>
                <Card>
                    <PasswordForm />
                </Card>
            </div>

            <Card>
                <BusinessProfileForm user={user} />
            </Card>

            {user.onboarding && (
                <Card>
                    <OnboardingDetailsCard user={user} />
                </Card>
            )}
        </div>
    );
}
