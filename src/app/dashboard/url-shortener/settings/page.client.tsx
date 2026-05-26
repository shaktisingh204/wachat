'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Separator,
  Skeleton,
} from '@/components/zoruui';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { Globe } from 'lucide-react';
import { getCustomDomains } from '@/app/actions/url-shortener.actions';
import { getSession } from '@/app/actions/index.ts';
import type { WithId, CustomDomain, User, Tag } from '@/lib/definitions';
import { DomainStepper } from './_components/domain-stepper';
import { DomainList } from './_components/domain-list';
import { DeveloperOptions } from './_components/developer-options';
import { TagsSettingsTab } from '@/components/wabasimplify/tags-settings-tab';

type SessionUser = Omit<User, 'password'> & { _id: string; tags?: Tag[] };

export default function UrlShortenerSettingsPage() {
  const [domains, setDomains] = useState<WithId<CustomDomain>[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, startLoadingTransition] = useTransition();
  const [isUserLoading, startUserLoadingTransition] = useTransition();

  const fetchData = useCallback(() => {
    startLoadingTransition(async () => {
      const data = await getCustomDomains();
      setDomains(data);
    });
  }, []);

  const fetchUser = useCallback(() => {
    startUserLoadingTransition(async () => {
      const session = await getSession();
      setUser((session?.user as SessionUser | undefined) ?? null);
    });
  }, []);

  useEffect(() => {
    fetchData();
    fetchUser();
  }, [fetchData, fetchUser]);

  const handleDomainAdded = async () => {
    const data = await getCustomDomains();
    setDomains(data);
  };

  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      <div>
        <h1 className="text-3xl text-zoru-ink">URL Shortener Settings</h1>
        <p className="text-zoru-ink-muted">Configure custom domains, tags, and developer settings for your short links.</p>
      </div>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" /> Custom Domains
          </ZoruCardTitle>
          <ZoruCardDescription>
            Use your own domain for branded short links (e.g., links.mybrand.com). You must own the domain and be able to configure its DNS records.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-6">
          <DomainStepper
            domains={domains}
            onDomainAdded={handleDomainAdded}
            onVerifySuccess={fetchData}
          />
          <Separator />
          <DomainList
            domains={domains}
            isLoading={isLoading}
            onRefresh={fetchData}
          />
        </ZoruCardContent>
      </Card>

      {isUserLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : user ? (
        <TagsSettingsTab user={user} />
      ) : null}

      <DeveloperOptions />
    </div>
  );
}
