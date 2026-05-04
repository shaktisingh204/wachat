'use client';

/**
 * Wachat Webhooks — rebuilt on Clay primitives.
 */

import * as React from 'react';
import { LuLightbulb, LuWebhook } from 'react-icons/lu';

import { WebhookInfo } from '@/components/wabasimplify/webhook-info';
import { WebhookLogs } from '@/components/wabasimplify/webhook-logs';
import { useProject } from '@/context/project-context';

import { ClayBreadcrumbs, ClayCard } from '@/components/clay';

export const dynamic = 'force-dynamic';

export default function WebhooksPage() {
  const { activeProject } = useProject();
  const verifyToken = process.env.NEXT_PUBLIC_META_VERIFY_TOKEN;
  const webhookPath = '/api/webhooks/meta';

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      {/* Breadcrumb */}
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/dashboard' },
          { label: activeProject?.name || 'Project', href: '/wachat' },
          { label: 'Webhooks' },
        ]}
      />

      {/* Header */}
      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
          Webhook configuration
        </h1>
        <p className="mt-1.5 max-w-[720px] text-[13px] text-muted-foreground">
          Point Meta&apos;s servers at your SabNode endpoint so deliveries,
          reads, and inbound messages flow back into the app in real time.
        </p>
      </div>

      {/* Existing (shared) Webhook info component */}
      <WebhookInfo webhookPath={webhookPath} verifyToken={verifyToken} />

      {/* Setup guide */}
      <ClayCard padded={false} className="p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent text-accent-foreground">
            <LuWebhook className="h-4 w-4" strokeWidth={2} />
          </span>
          <div>
            <div className="text-[15px] font-semibold text-foreground leading-tight">
              Setup guide
            </div>
            <div className="mt-0.5 text-[11.5px] text-muted-foreground">
              Follow these steps in your Meta App dashboard to complete
              webhook registration.
            </div>
          </div>
        </div>

        <ol className="mt-5 flex list-decimal flex-col gap-3 pl-5 text-[13px] leading-relaxed text-foreground">
          <li>
            Go to your Meta App&apos;s dashboard and select the{' '}
            <strong>Webhooks</strong> product.
          </li>
          <li>
            Find the object you want to subscribe to (e.g.{' '}
            <em>WhatsApp Business Account</em> or <em>Page</em>).
          </li>
          <li>
            Click <strong>Edit subscription</strong> or{' '}
            <strong>Subscribe to object</strong>.
          </li>
          <li>
            In the popup, paste the <strong>Callback URL</strong> and{' '}
            <strong>Verify token</strong> from above into the corresponding
            fields, then click <strong>Verify and save</strong>.
          </li>
          <li>
            <strong>This is the most important step:</strong> after verifying,
            find the event fields for that object and click{' '}
            <strong>Edit</strong> or <strong>Subscribe</strong>.
          </li>
          <li>
            For full functionality, subscribe to all relevant events:
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-6 text-[12.5px] text-muted-foreground">
              <li>
                <strong className="text-foreground">WhatsApp:</strong>{' '}
                <Code>messages</Code>, <Code>message_template_status_update</Code>,{' '}
                <Code>phone_number_quality_update</Code>
              </li>
              <li>
                <strong className="text-foreground">Facebook Pages:</strong>{' '}
                <Code>feed</Code> (comments), <Code>messages</Code> (Messenger)
              </li>
              <li>
                <strong className="text-foreground">E-Commerce:</strong>{' '}
                <Code>commerce_orders</Code>, <Code>catalog_product_events</Code>
              </li>
            </ul>
          </li>
        </ol>

        {/* Heads up callout */}
        <div className="mt-5 flex items-start gap-3 rounded-[12px] border border-border bg-secondary p-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#FEF3C7] text-[#92400E]">
            <LuLightbulb className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-foreground">
              Heads up
            </div>
            <div className="mt-0.5 text-[12px] text-muted-foreground leading-relaxed">
              Your application must be deployed to a public URL for Meta&apos;s
              servers to reach the callback endpoint. Test events work from the
              dashboard, but real events require a public deployment.
            </div>
          </div>
        </div>
      </ClayCard>

      {/* Webhook logs (shared component) */}
      <ClayCard padded={false} className="p-6">
        <div className="mb-4">
          <div className="text-[15px] font-semibold text-foreground">
            Recent events
          </div>
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">
            Live log of webhook events received for this project.
          </div>
        </div>
        <WebhookLogs filterByProject={true} />
      </ClayCard>

      <div className="h-6" />
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="inline-flex items-center rounded-[4px] border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] text-accent-foreground">
      {children}
    </code>
  );
}
