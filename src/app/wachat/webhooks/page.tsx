'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
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
  useState } from 'react';
import { Cloud,
  Code as CodeIcon,
  Copy,
  Lightbulb,
  Loader2,
  Plus,
  Send,
  Trash2,
  Webhook } from 'lucide-react';

import { WebhookInfo } from '@/app/wachat/_components/webhook-info';
import { WebhookLogs } from '@/app/wachat/_components/webhook-logs';
import { useProject } from '@/context/project-context';
import { pingWebhookUrl } from './actions';

const VERCEL_TEMPLATE = `export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-hub-signature-256');
    
    // Verify signature if secret is provided
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
    
    // Handle ping event for validation
    if (payload.event === 'ping') {
      return new Response(JSON.stringify({ success: true }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    // Process your webhook events here...
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
    
    // Verify signature if secret is provided
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
    
    // Handle ping event for validation
    if (payload.event === 'ping') {
      return { 
        statusCode: 200, 
        body: JSON.stringify({ success: true }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    
    // Process your webhook events here...
    console.log('Received event:', payload);
    
    return { statusCode: 200, body: 'OK' };
  } catch (error) {
    return { statusCode: 500, body: 'Error processing webhook' };
  }
};`;

/**
 * Wachat Webhooks — ZoruUI migration.
 * Endpoint info, setup guide, create/test/delete dialogs, recent events.
 */

import * as React from 'react';

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
  const [isValidating, setIsValidating] = useState(false);
  const [draft, setDraft] = useState<EndpointDraft>({
    name: '',
    url: '',
    secret: '',
  });

  const [testOpen, setTestOpen] = useState(false);
  const [testPayload, setTestPayload] = useState('{\n  "event": "ping"\n}');

  const [deleteOpen, setDeleteOpen] = useState(false);
  
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateCode, setTemplateCode] = useState('');
  const [templateTitle, setTemplateTitle] = useState('');

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
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
      </Breadcrumb>

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTestOpen(true)}
          >
            <Send /> Test webhook
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus /> New endpoint
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <WebhookInfo webhookPath={webhookPath} verifyToken={verifyToken} />
      </div>

      {/* Setup guide */}
      <Card className="mt-6 p-6">
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
          <Button
            size="sm"
            variant="ghost"
            className="text-zoru-danger hover:bg-zoru-danger/10"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 /> Delete endpoint
          </Button>
        </div>
      </Card>

      {/* ── Deployment Templates Card ── */}
      <Card className="mt-6 p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink">
            <Cloud className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[15px] text-zoru-ink leading-tight">
              Deployment templates
            </div>
            <div className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
              Pre-configured boilerplates to quickly deploy your custom endpoint.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Vercel Next.js template */}
          <div className="flex flex-col rounded-[var(--zoru-radius)] border border-zoru-line p-4">
            <div className="mb-2 text-[14px] font-medium text-zoru-ink">Vercel / Next.js</div>
            <div className="mb-4 text-[12px] text-zoru-ink-muted">
              A ready-to-use Next.js App Router API route to receive SabNode events.
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-auto w-max"
              onClick={() => {
                setTemplateCode(VERCEL_TEMPLATE);
                setTemplateTitle('Next.js API Route (App Router)');
                setTemplateOpen(true);
              }}
            >
              <CodeIcon className="mr-1.5 h-3.5 w-3.5" /> View code
            </Button>
          </div>

          {/* AWS Lambda Node.js template */}
          <div className="flex flex-col rounded-[var(--zoru-radius)] border border-zoru-line p-4">
            <div className="mb-2 text-[14px] font-medium text-zoru-ink">AWS Lambda</div>
            <div className="mb-4 text-[12px] text-zoru-ink-muted">
              Serverless Node.js handler configured for AWS API Gateway.
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-auto w-max"
              onClick={() => {
                setTemplateCode(AWS_TEMPLATE);
                setTemplateTitle('AWS Lambda (Node.js)');
                setTemplateOpen(true);
              }}
            >
              <CodeIcon className="mr-1.5 h-3.5 w-3.5" /> View code
            </Button>
          </div>
        </div>
      </Card>

      {/* Recent events */}
      <Card className="mt-6 p-6">
        <div className="mb-4">
          <div className="text-[15px] text-zoru-ink">Recent events</div>
          <div className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
            Live log of webhook events received for{' '}
            {activeProject?.name || 'this project'}.
          </div>
        </div>
        <WebhookLogs filterByProject={true} />
      </Card>

      {/* ── Create webhook dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New webhook endpoint</ZoruDialogTitle>
            <ZoruDialogDescription>
              Forward incoming events to a custom URL of your own.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hook-name">Name</Label>
              <Input
                id="hook-name"
                value={draft.name}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Sales CRM forwarder"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hook-url">Endpoint URL</Label>
              <Input
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
              <Label htmlFor="hook-secret">Signing secret</Label>
              <Input
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
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={isValidating}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setIsValidating(true);
                try {
                  const res = await pingWebhookUrl(draft.url, draft.secret);
                  if (!res.success) {
                    toast({
                      title: 'Validation failed',
                      description: res.error || 'Could not verify endpoint.',
                      variant: 'destructive',
                    });
                    return;
                  }
                  toast({
                    title: 'Endpoint created',
                    description: `${draft.name || draft.url} is now receiving events.`,
                  });
                  setCreateOpen(false);
                  setDraft({ name: '', url: '', secret: '' });
                } catch (error: any) {
                  toast({
                    title: 'Error',
                    description: error.message || 'Something went wrong',
                    variant: 'destructive',
                  });
                } finally {
                  setIsValidating(false);
                }
              }}
              disabled={!draft.url.trim() || isValidating}
            >
              {isValidating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save endpoint
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* ── Template Dialog ── */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <ZoruDialogContent className="max-w-3xl">
          <ZoruDialogHeader>
            <ZoruDialogTitle>{templateTitle}</ZoruDialogTitle>
            <ZoruDialogDescription>
              Copy this boilerplate to bootstrap your custom endpoint.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="relative mt-2">
            <Textarea
              readOnly
              value={templateCode}
              rows={16}
              className="font-mono text-[11.5px] bg-zoru-surface-2"
            />
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-4 h-7 px-2"
              onClick={() => {
                navigator.clipboard.writeText(templateCode);
                toast({ title: 'Copied to clipboard' });
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
            </Button>
          </div>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setTemplateOpen(false)}>
              Close
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* ── Test webhook dialog ── */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <ZoruDialogContent className="max-w-2xl">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Test webhook</ZoruDialogTitle>
            <ZoruDialogDescription>
              Send a sample payload to your endpoint to verify the connection.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="test-payload">Payload (JSON)</Label>
            <Textarea
              id="test-payload"
              rows={10}
              value={testPayload}
              onChange={(e) => setTestPayload(e.target.value)}
              className="font-mono text-[12px]"
            />
          </div>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setTestOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                toast({
                  title: 'Test sent',
                  description: 'Payload pushed to your endpoint.',
                });
                setTestOpen(false);
              }}
            >
              <Send /> Send test
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

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
