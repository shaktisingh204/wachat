'use client';

import {
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  SearchInput,
  Avatar,
  Badge,
} from '@/components/sabcrm/20ui';
import { useEffect, useState, useMemo } from 'react';
import { getSession } from '@/app/actions/user.actions';
import type { User } from '@/lib/definitions';
import { AlertCircle, SearchX, ShieldCheck, ShieldAlert, Languages } from 'lucide-react';

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
      <div className="mx-auto flex min-h-[400px] w-full max-w-4xl items-center justify-center">
        <EmptyState
          icon={AlertCircle}
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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-[var(--st-space-7)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Account</PageEyebrow>
          <PageTitle>Profile &amp; settings</PageTitle>
          <PageDescription>
            Manage your identity, security and business details.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <div className="w-full sm:w-64">
            <SearchInput
              value={searchQuery}
              onValueChange={setSearchQuery}
              placeholder="Search settings"
              aria-label="Search settings"
            />
          </div>
        </PageActions>
      </PageHeader>

      {/* Identity summary band */}
      <Card>
        <CardBody className="flex items-center gap-4">
          <Avatar
            name={user.name || user.email}
            src={user.image || undefined}
            size="lg"
            shape="round"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[var(--st-text)]">
              {user.name || 'Anonymous user'}
            </p>
            <p className="truncate text-sm text-[var(--st-text-secondary)]">{user.email}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {user.emailVerified ? (
              <Badge tone="success" kind="soft">
                <ShieldCheck size={12} aria-hidden="true" />
                Verified
              </Badge>
            ) : (
              <Badge tone="warning" kind="soft">
                <ShieldAlert size={12} aria-hidden="true" />
                Unverified
              </Badge>
            )}
            {user.language && (
              <Badge tone="neutral" kind="outline">
                <Languages size={12} aria-hidden="true" />
                {user.language.toUpperCase()}
              </Badge>
            )}
          </div>
        </CardBody>
      </Card>

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
        <Card>
          <EmptyState
            icon={SearchX}
            title="No matching settings"
            description={`Nothing matched "${searchQuery}". Try a different term.`}
            action={
              <Button variant="outline" onClick={() => setSearchQuery('')}>
                Clear search
              </Button>
            }
          />
        </Card>
      )}
    </div>
  );
}
