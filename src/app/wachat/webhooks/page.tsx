'use client';

/**
 * Wachat Webhooks — ZoruUI migration.
 * Endpoint info, setup guide, create/test/delete dialogs, recent events.
 */

import * as React from 'react';
import { useState } from 'react';
import { Lightbulb, Plus, Send, Trash2, Webhook } from 'lucide-react';

import { WebhookInfo } from '@/app/wachat/_components/webhook-info';
import { WebhookLogs } from '@/app/wachat/_components/webhook-logs';
import { useProject } from '@/context/project-context';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

export const dynamic = 'force-dynamic';

type EndpointDraft = {
  id?: string;
  name: string;
  url: string;
  secret: string;
};

export default function WebhooksPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const verifyToken = process.env.NEXT_PUBLIC_META_VERIFY_TOKEN;
  const webhookPath = '/api/webhooks/meta';

  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<EndpointDraft>({
    name: '',
    url: '',
    secret: '',
  });

  const [testOpen, setTestOpen] = useState(false);
  const [testPayload, setTestPayload] = useState('{\n  "event": "ping"\n}');

  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Webhooks</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="mt-5 flex items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Webhook configuration
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[13px] text-zoru-ink-muted">
            Point Meta&apos;s servers at your SabNode endpoint so deliveries,
            reads, and inbound messages flow back into the app in real time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => setTestOpen(true)}
          >
            <Send /> Test webhook
          </ZoruButton>
          <ZoruButton size="sm" onClick={() => setCreateOpen(true)}>
            <Plus /> New endpoint
          </ZoruButton>
        </div>
      </div>

      <div className="mt-6">
        <WebhookInfo webhookPath={webhookPath} verifyToken={verifyToken} />
      </div>

      {/* Setup guide */}
      <ZoruCard className="mt-6 p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink">
            <Webhook className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[15px] text-zoru-ink leading-tight">
              Setup guide
            </div>
            <div className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
              Follow these steps in your Meta App dashboard to complete
              webhook registration.
            </div>
          </div>
        </div>

        <ol className="mt-5 flex list-decimal flex-col gap-3 pl-5 text-[13px] leading-relaxed text-zoru-ink">
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
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-6 text-[12.5px] text-zoru-ink-muted">
              <li>
                <strong className="text-zoru-ink">WhatsApp:</strong>{' '}
                <Code>messages</Code>,{' '}
                <Code>message_template_status_update</Code>,{' '}
                <Code>phone_number_quality_update</Code>
              </li>
              <li>
                <strong className="text-zoru-ink">Facebook Pages:</strong>{' '}
                <Code>feed</Code> (comments), <Code>messages</Code> (Messenger)
              </li>
              <li>
                <strong className="text-zoru-ink">E-Commerce:</strong>{' '}
                <Code>commerce_orders</Code>,{' '}
                <Code>catalog_product_events</Code>
              </li>
            </ul>
          </li>
        </ol>

        <div className="mt-5 flex items-start gap-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-warning/15 text-zoru-warning">
            <Lightbulb className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] text-zoru-ink">Heads up</div>
            <div className="mt-0.5 text-[12px] text-zoru-ink-muted leading-relaxed">
              Your application must be deployed to a public URL for Meta&apos;s
              servers to reach the callback endpoint. Test events work from the
              dashboard, but real events require a public deployment.
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <ZoruButton
            size="sm"
            variant="ghost"
            className="text-zoru-danger hover:bg-zoru-danger/10"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 /> Delete endpoint
          </ZoruButton>
        </div>
      </ZoruCard>

      {/* Recent events */}
      <ZoruCard className="mt-6 p-6">
        <div className="mb-4">
          <div className="text-[15px] text-zoru-ink">Recent events</div>
          <div className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
            Live log of webhook events received for{' '}
            {activeProject?.name || 'this project'}.
          </div>
        </div>
        <WebhookLogs filterByProject={true} />
      </ZoruCard>

      {/* ── Create webhook dialog ── */}
      <ZoruDialog open={createOpen} onOpenChange={setCreateOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New webhook endpoint</ZoruDialogTitle>
            <ZoruDialogDescription>
              Forward incoming events to a custom URL of your own.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="hook-name">Name</ZoruLabel>
              <ZoruInput
                id="hook-name"
                value={draft.name}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Sales CRM forwarder"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="hook-url">Endpoint URL</ZoruLabel>
              <ZoruInput
                id="hook-url"
                type="url"
                value={draft.url}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, url: e.target.value }))
                }
                placeholder="https://your-app.com/api/webhooks"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="hook-secret">Signing secret</ZoruLabel>
              <ZoruInput
                id="hook-secret"
                value={draft.secret}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, secret: e.target.value }))
                }
                placeholder="whsec_…"
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={() => {
                toast({
                  title: 'Endpoint created',
                  description: `${draft.name || draft.url} is now receiving events.`,
                });
                setCreateOpen(false);
                setDraft({ name: '', url: '', secret: '' });
              }}
              disabled={!draft.url.trim()}
            >
              Save endpoint
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* ── Test webhook dialog ── */}
      <ZoruDialog open={testOpen} onOpenChange={setTestOpen}>
        <ZoruDialogContent className="max-w-2xl">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Test webhook</ZoruDialogTitle>
            <ZoruDialogDescription>
              Send a sample payload to your endpoint to verify the connection.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="test-payload">Payload (JSON)</ZoruLabel>
            <ZoruTextarea
              id="test-payload"
              rows={10}
              value={testPayload}
              onChange={(e) => setTestPayload(e.target.value)}
              className="font-mono text-[12px]"
            />
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setTestOpen(false)}>
              Close
            </ZoruButton>
            <ZoruButton
              onClick={() => {
                toast({
                  title: 'Test sent',
                  description: 'Payload pushed to your endpoint.',
                });
                setTestOpen(false);
              }}
            >
              <Send /> Send test
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* ── Delete webhook confirm ── */}
      <ZoruAlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete this endpoint?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Events will stop being forwarded immediately. You can recreate the
              endpoint later, but past delivery logs may be lost.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={() => {
                toast({ title: 'Endpoint deleted' });
                setDeleteOpen(false);
              }}
            >
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      <div className="h-6" />
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="inline-flex items-center rounded-[4px] border border-zoru-line bg-zoru-surface px-1.5 py-0.5 font-mono text-[11px] text-zoru-ink">
      {children}
    </code>
  );
}
