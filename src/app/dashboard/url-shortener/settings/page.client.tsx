'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Separator,
} from '@/components/zoruui';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { Globe } from 'lucide-react';
import { getCustomDomains } from '@/app/actions/url-shortener.actions';
import type { WithId, CustomDomain } from '@/lib/definitions';
import { DomainStepper } from './_components/domain-stepper';
import { DomainList } from './_components/domain-list';
import { DeveloperOptions } from './_components/developer-options';

export default function UrlShortenerSettingsPage() {
  const [domains, setDomains] = useState<WithId<CustomDomain>[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();

  const fetchData = useCallback(() => {
    startLoadingTransition(async () => {
      const data = await getCustomDomains();
      setDomains(data);
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDomainAdded = async () => {
    const data = await getCustomDomains();
    setDomains(data);
  };

  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      <div>
        <h1 className="text-3xl text-zoru-ink">URL Shortener Settings</h1>
        <p className="text-zoru-ink-muted">Configure custom domains and developer settings for your short links.</p>
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

      <DeveloperOptions />
    </div>
  );
}
