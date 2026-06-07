'use client';

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, PageActions, PageDescription, PageEyebrow, PageHeader, PageHeading, PageTitle } from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cog,
  ExternalLink,
  Webhook } from 'lucide-react';

/**
 * /dashboard/facebook/webhooks — Webhook endpoints (Ui20).
 *
 * Replaces the legacy WebhookLogs from @/components/20ui-domain with
 * the local FacebookWebhookLogs (which already wraps create / test /
 * delete dialogs and renders inside Ui20DataTable-like Ui20 chrome).
 *
 * Page chrome:
 *   - Breadcrumb  (SabNode › Meta Suite › Webhooks)
 *   - PageHeader  (eyebrow + title + description + actions)
 *   - Status alert when no project is selected
 *   - FacebookWebhookLogs body
 */

import * as React from 'react';

import { FacebookWebhookLogs } from '../_components/facebook-webhook-logs';
import { NoProjectState } from '../_components/no-project-state';

export default function FacebookWebhooksPage() {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setProjectId(localStorage.getItem('activeProjectId'));
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Webhooks</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page header */}
      <PageHeader className="mt-4">
        <PageHeading>
          <PageEyebrow>Meta Suite · Infrastructure</PageEyebrow>
          <PageTitle>
            <span className="inline-flex items-center gap-2.5">
              <Webhook className="h-6 w-6 text-[var(--st-text-secondary)]" />
              Webhooks
            </span>
          </PageTitle>
          <PageDescription>
            Real-time log of webhook events received from Meta for the active
            project. Use the toolbar to send a test event or clear processed
            entries.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/facebook/settings')}
          >
            <Cog /> Page settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(
                'https://developers.facebook.com/docs/messenger-platform/webhooks',
                '_blank',
                'noopener,noreferrer',
              )
            }
          >
            <ExternalLink /> Meta docs
          </Button>
        </PageActions>
      </PageHeader>

      {/* Body */}
      <div className="mt-6">
        {isClient && !projectId ? (
          <NoProjectState />
        ) : (
          <FacebookWebhookLogs filterByProject={true} />
        )}
      </div>
    </div>
  );
}
