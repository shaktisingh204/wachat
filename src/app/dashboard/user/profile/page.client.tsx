'use client';

import {
  Card,
  Input,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
} from '@/components/sabcrm/20ui';
import { useEffect, useState, useMemo } from 'react';
import { getSession } from '@/app/actions/user.actions';
import type { User } from '@/lib/definitions';
import { AlertCircle, Search, SearchX } from 'lucide-react';

import { ProfileForm } from './components/ProfileForm';
import { BusinessProfileForm } from './components/BusinessProfileForm';
import { PasswordForm } from './components/PasswordForm';
import { OnboardingDetailsCard } from './components/OnboardingDetailsCard';
import { ProfilePageSkeleton } from './components/ProfilePageSkeleton';

export default function ProfilePage() {
  const [user, setUser] = useState<Omit<User, 'password'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.title = 'My Profile | SabNode';
    getSession().then((session) => {
      if (session?.user) {
        setUser(session.user);
      }
      setLoading(false);
    });
  }, []);

  const filteredSections = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return {
      profile: 'user profile name email account created language sidebar'.includes(query),
      password: 'change password current new confirm security'.includes(query),
      business: 'business profile address gstin pan invoices vouchers'.includes(query),
      onboarding: 'onboarding details setup status company role industry use cases'.includes(
        query,
      ),
    };
  }, [searchQuery]);

  if (loading) {
    return <ProfilePageSkeleton />;
  }

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[400px] w-full max-w-4xl items-center justify-center px-4 py-6">
        <EmptyState
          icon={<AlertCircle />}
          tone="danger"
          title="Couldn't load your profile"
          description="Your session may have expired. Try signing in again."
          action={
            <Button asChild variant="outline">
              <a href="/login">Sign in</a>
            </Button>
          }
        />
      </div>
    );
  }

  const anyMatch = Object.values(filteredSections).some(Boolean);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 space-y-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Account</PageEyebrow>
          <PageTitle>Profile &amp; settings</PageTitle>
          <PageDescription>
            Manage your identity, security and business details.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <div className="relative w-full sm:w-64">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]"
            />
            <Input
              type="search"
              aria-label="Search settings"
              placeholder="Search settings…"
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </PageActions>
      </PageHeader>

      {anyMatch ? (
        <div className="space-y-6">
          <div className="grid items-start gap-6 md:grid-cols-2">
            {filteredSections.profile && (
              <Card>
                <ProfileForm user={user} />
              </Card>
            )}
            {filteredSections.password && (
              <Card>
                <PasswordForm />
              </Card>
            )}
          </div>

          {filteredSections.business && (
            <Card>
              <BusinessProfileForm user={user} />
            </Card>
          )}

          {filteredSections.onboarding && user.onboarding && (
            <Card>
              <OnboardingDetailsCard user={user} />
            </Card>
          )}
        </div>
      ) : (
        <EmptyState
          icon={<SearchX />}
          title="No matching settings"
          description={`Nothing matched “${searchQuery}”. Try a different term.`}
          action={
            <Button variant="outline" onClick={() => setSearchQuery('')}>
              Clear search
            </Button>
          }
        />
      )}
    </div>
  );
}
