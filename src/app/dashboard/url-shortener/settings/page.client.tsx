'use client';

import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  Separator,
  Skeleton,
} from '@/components/sabcrm/20ui';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { Globe, Settings as SettingsIcon } from 'lucide-react';
import { getCustomDomains } from '@/app/actions/url-shortener.actions';
import { getSession } from '@/app/actions/index.ts';
import type { WithId, CustomDomain, User, Tag } from '@/lib/definitions';
import { DomainStepper } from './_components/domain-stepper';
import { DomainList } from './_components/domain-list';
import { DeveloperOptions } from './_components/developer-options';
import { TagsSettingsTab } from './_components/tags-settings-tab';

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
      <PageHeader bordered={false}>
        <PageHeaderHeading>
          <PageEyebrow>
            <span className="inline-flex items-center gap-1.5">
              <SettingsIcon className="h-3.5 w-3.5" aria-hidden="true" />
              URL shortener
            </span>
          </PageEyebrow>
          <PageTitle>Settings</PageTitle>
          <PageDescription>
            Configure custom domains, tags, and developer settings for your short links.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" aria-hidden="true" /> Custom domains
          </CardTitle>
          <CardDescription>
            Use your own domain for branded short links (e.g. links.mybrand.com). You must own the domain and be able to configure its DNS records.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-6">
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
        </CardBody>
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
