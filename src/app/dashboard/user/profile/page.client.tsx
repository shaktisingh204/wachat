'use client';

import { Card, CardBody, CardHeader, CardTitle, Input } from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useMemo,
} from 'react';
import { getSession } from '@/app/actions/user.actions';
import type { User } from '@/lib/definitions';
import { AlertCircle, Search } from 'lucide-react';

import { ProfileForm } from './components/ProfileForm';
import { BusinessProfileForm } from './components/BusinessProfileForm';
import { PasswordForm } from './components/PasswordForm';
import { OnboardingDetailsCard } from './components/OnboardingDetailsCard';
import { ProfilePageSkeleton } from './components/ProfilePageSkeleton';

export default function ProfilePage() {
    const [user, setUser] = useState<(Omit<User, 'password'>) | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        document.title = "My Profile | SabNode";
        getSession().then(session => {
            if (session?.user) {
                setUser(session.user);
            }
            setLoading(false);
        });
    }, []);

    const filteredSections = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return {
            profile: 'user profile name email account created'.includes(query),
            password: 'change password current new confirm'.includes(query),
            business: 'business profile address gstin invoices vouchers'.includes(query),
            onboarding: 'onboarding details setup status company role industry use cases'.includes(query),
        };
    }, [searchQuery]);

    if (loading) {
        return <ProfilePageSkeleton />;
    }

    if (!user) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><AlertCircle /> Error</CardTitle>
                </CardHeader>
                <CardBody>
                    <p>Could not load user profile. You may need to log in again.</p>
                </CardBody>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Profile & Settings</h1>
                    <p className="text-[var(--st-text-secondary)]">Manage your account settings and preferences.</p>
                </div>
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
                    <Input
                        type="search"
                        placeholder="Search settings..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-start">
                {filteredSections.profile && (
                    <Card><ProfileForm user={user} /></Card>
                )}
                {filteredSections.password && (
                    <Card><PasswordForm /></Card>
                )}
            </div>
            
            {filteredSections.business && (
                <Card><BusinessProfileForm user={user} /></Card>
            )}
            
            {filteredSections.onboarding && user.onboarding && (
                <Card><OnboardingDetailsCard user={user} /></Card>
            )}

            {!Object.values(filteredSections).some(Boolean) && (
                <div className="text-center py-12 text-[var(--st-text-secondary)]">
                    <p>No settings matched your search query "{searchQuery}".</p>
                </div>
            )}
        </div>
    )
}
