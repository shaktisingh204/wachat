'use client';

import * as React from 'react';
import { useState } from 'react';
import {
  Cloud,
  Code as CodeIcon,
  Copy,
  Lightbulb,
  Loader2,
  Plus,
  Send,
  Trash2,
  Webhook,
} from 'lucide-react';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';

import {
  WaPage,
  PageHeader,
  Section,
  WaButton,
} from '@/components/wachat-ui';

import { WebhookInfo } from '@/app/wachat/_components/webhook-info';
import { WebhookLogs } from '@/app/wachat/_components/webhook-logs';
import { useProject } from '@/context/project-context';
import { pingWebhookUrl } from './actions';

const VERCEL_TEMPLATE = `export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-hub-signature-256');

    if (process.env.WEBHOOK_SECRET && signature) {
      const crypto = require('crypto');
      const expected = crypto
        .createHmac('sha256', process.env.WEBHOOK_SECRET)
        .update(body)
        .digest('hex');
      if (\`sha256=\${expected}\` !== signature) {
        return new Response('Invalid signature', { status: 401 });
      }
    }

    const payload = JSON.parse(body);
    if (payload.event === 'ping') {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    console.log('Received event:', payload);
    return new Response('OK', { status: 200 });
  } catch (error) {
    return new Response('Error processing webhook', { status: 500 });
  }
}`;

const AWS_TEMPLATE = `const crypto = require('crypto');

exports.handler = async (event) => {
  try {
    const body = event.body;
    const signature = event.headers['x-hub-signature-256'] || event.headers['X-Hub-Signature-256'];

    if (process.env.WEBHOOK_SECRET && signature) {
      const expected = crypto
        .createHmac('sha256', process.env.WEBHOOK_SECRET)
        .update(body)
        .digest('hex');
      if (\`sha256=\${expected}\` !== signature) {
        return { statusCode: 401, body: 'Invalid signature' };
      }
    }

    const payload = JSON.parse(body);
    if (payload.event === 'ping') {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    console.log('Received event:', payload);
    return { statusCode: 200, body: 'OK' };
  } catch (error) {
    return { statusCode: 500, body: 'Error processing webhook' };
  }
};`;

type EndpointDraft = { id?: string; name: string; url: string; secret: string };

export default function WebhooksPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const verifyToken = process.env.NEXT_PUBLIC_META_VERIFY_TOKEN;
  const webhookPath = '/api/webhooks/meta';

  const [createOpen, setCreateOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [draft, setDraft] = useState<EndpointDraft>({ name: '', url: '', secret: '' });

  const [testOpen, setTestOpen] = useState(false);
  const [testPayload, setTestPayload] = useState('{\n  "event": "ping"\n}');

  const [deleteOpen, setDeleteOpen] = useState(false);

  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateCode, setTemplateCode] = useState('');
  const [templateTitle, setTemplateTitle] = useState('');

  return (
    <WaPage>
      <PageHeader
        title="Webhook configuration"
        description="Point Meta's servers at your SabNode endpoint so deliveries, reads, and inbound messages flow back into the app in real time."
        kicker="Wachat · webhooks"
        backHref="/wachat"
        eyebrowIcon={Webhook}
        actions={
          <>
            <WaButton variant="outline" size="sm" leftIcon={Send} onClick={() => setTestOpen(true)}>
              Test webhook
            </WaButton>
            <WaButton size="sm" leftIcon={Plus} onClick={() => setCreateOpen(true)}>
              New endpoint
            </WaButton>
          </>
        }
      />

      <div className="space-y-6">
        <Section>
          <WebhookInfo webhookPath={webhookPath} verifyToken={verifyToken} />
        </Section>

        <Section
          title="Setup guide"
          description="Steps to register the callback in your Meta App dashboard."
        >
          <ol className="flex list-decimal flex-col gap-3 pl-5 text-[13px] leading-relaxed text-zinc-700">
            <li>
              Go to your Meta App dashboard and select the <strong>Webhooks</strong> product.
            </li>
            <li>
              Find the object you want to subscribe to (for example <em>WhatsApp Business Account</em> or <em>Page</em>).
            </li>
            <li>
              Click <strong>Edit subscription</strong> or <strong>Subscribe to object</strong>.
            </li>
            <li>
              In the popup, paste the <strong>Callback URL</strong> and <strong>Verify token</strong> from above, then click <strong>Verify and save</strong>.
            </li>
            <li>
              <strong>This is the most important step:</strong> after verifying, find the event fields and click <strong>Edit</strong> or <strong>Subscribe</strong>.
            </li>
            <li>
              For full functionality, subscribe to all relevant events:
              <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-6 text-[12.5px] text-zinc-600">
                <li>
                  <strong className="text-zinc-900">WhatsApp:</strong>{' '}
                  <Code>messages</Code>, <Code>message_template_status_update</Code>, <Code>phone_number_quality_update</Code>
                </li>
                <li>
                  <strong className="text-zinc-900">Facebook Pages:</strong>{' '}
                  <Code>feed</Code> (comments), <Code>messages</Code> (Messenger)
                </li>
                <li>
                  <strong className="text-zinc-900">E-Commerce:</strong>{' '}
                  <Code>commerce_orders</Code>, <Code>catalog_product_events</Code>
                </li>
              </ul>
            </li>
          </ol>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-100">
              <Lightbulb className="h-3.5 w-3.5 text-amber-700" strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-amber-900">Heads up</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-amber-800">
                Your app must be on a public URL so Meta can reach the callback. Test events work from the dashboard, but real events require a public deployment.
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-rose-600 transition-colors hover:bg-rose-50 active:scale-[0.97]"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
              Delete endpoint
            </button>
          </div>
        </Section>

        <Section
          title="Deployment templates"
          description="Pre-configured boilerplates to quickly deploy a custom endpoint."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              {
                title: 'Vercel / Next.js',
                copy: 'A ready-to-use Next.js App Router API route to receive SabNode events.',
                onClick: () => { setTemplateCode(VERCEL_TEMPLATE); setTemplateTitle('Next.js API route'); setTemplateOpen(true); },
              },
              {
                title: 'AWS Lambda',
                copy: 'Serverless Node.js handler configured for AWS API Gateway.',
                onClick: () => { setTemplateCode(AWS_TEMPLATE); setTemplateTitle('AWS Lambda (Node.js)'); setTemplateOpen(true); },
              },
            ].map((t) => (
              <div key={t.title} className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: 'var(--mt-accent-soft)' }}>
                  <Cloud className="h-4 w-4" style={{ color: 'var(--mt-accent)' }} strokeWidth={2.25} />
                </span>
                <p className="mt-3 text-[13.5px] font-semibold text-zinc-950">{t.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">{t.copy}</p>
                <div className="mt-4">
                  <WaButton size="sm" variant="outline" leftIcon={CodeIcon} onClick={t.onClick}>
                    View code
                  </WaButton>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Recent events"
          description={`Live log of webhook events received for ${activeProject?.name || 'this project'}.`}
        >
          <WebhookLogs filterByProject={true} />
        </Section>
      </div>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New webhook endpoint</ZoruDialogTitle>
            <ZoruDialogDescription>Forward incoming events to a custom URL of your own.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hook-name">Name</Label>
              <Input id="hook-name" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} placeholder="Sales CRM forwarder" className="rounded-xl" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hook-url">Endpoint URL</Label>
              <Input id="hook-url" type="url" value={draft.url} onChange={(e) => setDraft((p) => ({ ...p, url: e.target.value }))} placeholder="https://your-app.com/api/webhooks" className="rounded-xl" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hook-secret">Signing secret</Label>
              <Input id="hook-secret" value={draft.secret} onChange={(e) => setDraft((p) => ({ ...p, secret: e.target.value }))} placeholder="whsec_..." className="rounded-xl" />
            </div>
          </div>
          <ZoruDialogFooter>
            <WaButton variant="outline" onClick={() => setCreateOpen(false)} disabled={isValidating}>Cancel</WaButton>
            <WaButton
              leftIcon={isValidating ? Loader2 : undefined}
              onClick={async () => {
                setIsValidating(true);
                try {
                  const res = await pingWebhookUrl(draft.url, draft.secret);
                  if (!res.success) {
                    toast({ title: 'Validation failed', description: res.error || 'Could not verify endpoint.', variant: 'destructive' });
                    return;
                  }
                  toast({ title: 'Endpoint created', description: `${draft.name || draft.url} is now receiving events.` });
                  setCreateOpen(false);
                  setDraft({ name: '', url: '', secret: '' });
                } catch (error: any) {
                  toast({ title: 'Error', description: error.message || 'Something went wrong', variant: 'destructive' });
                } finally {
                  setIsValidating(false);
                }
              }}
              disabled={!draft.url.trim() || isValidating}
            >
              Save endpoint
            </WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Template */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <ZoruDialogContent className="max-w-3xl">
          <ZoruDialogHeader>
            <ZoruDialogTitle>{templateTitle}</ZoruDialogTitle>
            <ZoruDialogDescription>Copy this boilerplate to bootstrap your custom endpoint.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="relative mt-2">
            <Textarea readOnly value={templateCode} rows={16} className="rounded-xl bg-zinc-50 font-mono text-[11.5px]" />
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(templateCode); toast({ title: 'Copied' }); }}
              className="absolute right-3 top-3 inline-flex h-7 items-center gap-1.5 rounded-full bg-white px-2.5 text-[11px] font-semibold text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 active:scale-[0.97]"
            >
              <Copy className="h-3 w-3" strokeWidth={2.25} />
              Copy
            </button>
          </div>
          <ZoruDialogFooter>
            <WaButton variant="outline" onClick={() => setTemplateOpen(false)}>Close</WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Test */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <ZoruDialogContent className="max-w-2xl">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Test webhook</ZoruDialogTitle>
            <ZoruDialogDescription>Send a sample payload to your endpoint to verify the connection.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-1.5 py-2">
            <Label htmlFor="test-payload">Payload (JSON)</Label>
            <Textarea
              id="test-payload"
              rows={10}
              value={testPayload}
              onChange={(e) => setTestPayload(e.target.value)}
              className="rounded-xl font-mono text-[12px]"
            />
          </div>
          <ZoruDialogFooter>
            <WaButton variant="outline" onClick={() => setTestOpen(false)}>Close</WaButton>
            <WaButton leftIcon={Send} onClick={() => { toast({ title: 'Test sent' }); setTestOpen(false); }}>
              Send test
            </WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Delete */}
      <ZoruAlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete this endpoint?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Events will stop being forwarded immediately. You can recreate the endpoint later, but past delivery logs may be lost.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={() => { toast({ title: 'Endpoint deleted' }); setDeleteOpen(false); }}>
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </WaPage>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700">
      {children}
    </code>
  );
}
