'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/zoruui';
import {
  useEffect,
  useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cog,
  ExternalLink,
  Webhook } from 'lucide-react';

/**
 * /dashboard/facebook/webhooks — Webhook endpoints (ZoruUI).
 *
 * Replaces the legacy WebhookLogs from @/components/wabasimplify with
 * the local FacebookWebhookLogs (which already wraps create / test /
 * delete dialogs and renders inside ZoruDataTable-like Zoru chrome).
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
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Webhooks</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      {/* Page header */}
      <PageHeader className="mt-4">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Meta Suite · Infrastructure</ZoruPageEyebrow>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-2.5">
              <Webhook className="h-6 w-6 text-zoru-ink-muted" />
              Webhooks
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Real-time log of webhook events received from Meta for the active
            project. Use the toolbar to send a test event or clear processed
            entries.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
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
        </ZoruPageActions>
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
