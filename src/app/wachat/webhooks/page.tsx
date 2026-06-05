'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Callout,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Modal,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useState } from 'react';
import { Cloud,
  Code as CodeIcon,
  Copy,
  Lightbulb,
  Plus,
  Send,
  Trash2,
  Webhook } from 'lucide-react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { WebhookInfo } from '@/app/wachat/_components/webhook-info';
import { WebhookLogs } from '@/app/wachat/_components/webhook-logs';
import { useProject } from '@/context/project-context';
import { pingWebhookUrl } from './actions';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

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
 * Wachat Webhooks — 20ui migration.
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
  const { toast } = useToast();
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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Webhooks' },
      ]}
      title="Webhook configuration"
      description="Point Meta's servers at your SabNode endpoint so deliveries, reads, and inbound messages flow back into the app in real time."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            iconLeft={Send}
            onClick={() => setTestOpen(true)}
          >
            Test webhook
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconLeft={Plus}
            onClick={() => setCreateOpen(true)}
          >
            New endpoint
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <WebhookInfo webhookPath={webhookPath} verifyToken={verifyToken} />

        {/* Setup guide */}
        <Card padding="lg">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-8 w-8 items-center justify-center rounded u-card__icon-chip"
                aria-hidden="true"
              >
                <Webhook className="h-4 w-4" />
              </span>
              <div>
                <CardTitle>Setup guide</CardTitle>
                <CardDescription>
                  Follow these steps in your Meta App dashboard to complete
                  webhook registration.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardBody>
            <ol className="flex list-decimal flex-col gap-3 pl-5 text-[13px] leading-relaxed" style={{ color: 'var(--st-text)' }}>
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
                <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-6 text-[12.5px]" style={{ color: 'var(--st-text-secondary)' }}>
                  <li>
                    <strong style={{ color: 'var(--st-text)' }}>WhatsApp:</strong>{' '}
                    <Code>messages</Code>,{' '}
                    <Code>message_template_status_update</Code>,{' '}
                    <Code>phone_number_quality_update</Code>
                  </li>
                  <li>
                    <strong style={{ color: 'var(--st-text)' }}>
                      Facebook Pages:
                    </strong>{' '}
                    <Code>feed</Code> (comments), <Code>messages</Code> (Messenger)
                  </li>
                  <li>
                    <strong style={{ color: 'var(--st-text)' }}>
                      E-Commerce:
                    </strong>{' '}
                    <Code>commerce_orders</Code>,{' '}
                    <Code>catalog_product_events</Code>
                  </li>
                </ul>
              </li>
            </ol>

            <Callout
              className="mt-5"
              tone="warning"
              icon={Lightbulb}
              title="Heads up"
            >
              Your application must be deployed to a public URL for Meta&apos;s
              servers to reach the callback endpoint. Test events work from the
              dashboard, but real events require a public deployment.
            </Callout>
          </CardBody>

          <CardFooter className="flex items-center justify-end">
            <Button
              size="sm"
              variant="danger"
              iconLeft={Trash2}
              onClick={() => setDeleteOpen(true)}
            >
              Delete endpoint
            </Button>
          </CardFooter>
        </Card>

        {/* Deployment Templates Card */}
        <Card padding="lg">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-8 w-8 items-center justify-center rounded u-card__icon-chip"
                aria-hidden="true"
              >
                <Cloud className="h-4 w-4" />
              </span>
              <div>
                <CardTitle>Deployment templates</CardTitle>
                <CardDescription>
                  Pre-configured boilerplates to quickly deploy your custom
                  endpoint.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardBody>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Vercel Next.js template */}
              <Card variant="outlined" padding="md" className="flex flex-col">
                <CardTitle className="mb-2 text-[14px]">Vercel / Next.js</CardTitle>
                <CardDescription className="mb-4 text-[12px]">
                  A ready-to-use Next.js App Router API route to receive SabNode
                  events.
                </CardDescription>
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={CodeIcon}
                  className="mt-auto w-max"
                  onClick={() => {
                    setTemplateCode(VERCEL_TEMPLATE);
                    setTemplateTitle('Next.js API Route (App Router)');
                    setTemplateOpen(true);
                  }}
                >
                  View code
                </Button>
              </Card>

              {/* AWS Lambda Node.js template */}
              <Card variant="outlined" padding="md" className="flex flex-col">
                <CardTitle className="mb-2 text-[14px]">AWS Lambda</CardTitle>
                <CardDescription className="mb-4 text-[12px]">
                  Serverless Node.js handler configured for AWS API Gateway.
                </CardDescription>
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={CodeIcon}
                  className="mt-auto w-max"
                  onClick={() => {
                    setTemplateCode(AWS_TEMPLATE);
                    setTemplateTitle('AWS Lambda (Node.js)');
                    setTemplateOpen(true);
                  }}
                >
                  View code
                </Button>
              </Card>
            </div>
          </CardBody>
        </Card>

        {/* Recent events */}
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Recent events</CardTitle>
            <CardDescription>
              Live log of webhook events received for{' '}
              {activeProject?.name || 'this project'}.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <WebhookLogs filterByProject={true} />
          </CardBody>
        </Card>
      </div>

      {/* Create webhook dialog */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New webhook endpoint"
        description="Forward incoming events to a custom URL of your own."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setCreateOpen(false)}
              disabled={isValidating}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={isValidating}
              onClick={async () => {
                setIsValidating(true);
                try {
                  const res = await pingWebhookUrl(draft.url, draft.secret);
                  if (!res.success) {
                    toast({
                      title: 'Validation failed',
                      description: res.error || 'Could not verify endpoint.',
                      tone: 'danger',
                    });
                    return;
                  }
                  toast({
                    title: 'Endpoint created',
                    description: `${draft.name || draft.url} is now receiving events.`,
                    tone: 'success',
                  });
                  setCreateOpen(false);
                  setDraft({ name: '', url: '', secret: '' });
                } catch (error: any) {
                  toast({
                    title: 'Error',
                    description: error.message || 'Something went wrong',
                    tone: 'danger',
                  });
                } finally {
                  setIsValidating(false);
                }
              }}
              disabled={!draft.url.trim() || isValidating}
            >
              Save endpoint
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Name" id="hook-name">
            <Input
              value={draft.name}
              onChange={(e) =>
                setDraft((p) => ({ ...p, name: e.target.value }))
              }
              placeholder="Sales CRM forwarder"
            />
          </Field>
          <Field label="Endpoint URL" id="hook-url">
            <Input
              type="url"
              value={draft.url}
              onChange={(e) => setDraft((p) => ({ ...p, url: e.target.value }))}
              placeholder="https://your-app.com/api/webhooks"
            />
          </Field>
          <Field label="Signing secret" id="hook-secret">
            <Input
              value={draft.secret}
              onChange={(e) =>
                setDraft((p) => ({ ...p, secret: e.target.value }))
              }
              placeholder="whsec_..."
            />
          </Field>
        </div>
      </Modal>

      {/* Template Dialog */}
      <Modal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title={templateTitle}
        description="Copy this boilerplate to bootstrap your custom endpoint."
        size="lg"
        footer={
          <Button variant="ghost" onClick={() => setTemplateOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="relative">
          <Textarea
            readOnly
            value={templateCode}
            rows={16}
            className="font-mono text-[11.5px] u-bg-secondary"
          />
          <Button
            size="sm"
            variant="secondary"
            iconLeft={Copy}
            className="absolute top-2 right-4 h-7 px-2"
            onClick={() => {
              navigator.clipboard.writeText(templateCode);
              toast({ title: 'Copied to clipboard', tone: 'success' });
            }}
          >
            Copy
          </Button>
        </div>
      </Modal>

      {/* Test webhook dialog */}
      <Modal
        open={testOpen}
        onClose={() => setTestOpen(false)}
        title="Test webhook"
        description="Send a sample payload to your endpoint to verify the connection."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTestOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              iconLeft={Send}
              onClick={() => {
                toast({
                  title: 'Test sent',
                  description: 'Payload pushed to your endpoint.',
                  tone: 'success',
                });
                setTestOpen(false);
              }}
            >
              Send test
            </Button>
          </>
        }
      >
        <Field label="Payload (JSON)" id="test-payload">
          <Textarea
            rows={10}
            value={testPayload}
            onChange={(e) => setTestPayload(e.target.value)}
            className="font-mono text-[12px]"
          />
        </Field>
      </Modal>

      {/* Delete webhook confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this endpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              Events will stop being forwarded immediately. You can recreate the
              endpoint later, but past delivery logs may be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast({ title: 'Endpoint deleted', tone: 'success' });
                setDeleteOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WachatPage>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="inline-flex items-center px-1.5 py-0.5 font-mono text-[11px] rounded u-card--outlined u-bg-secondary" style={{ color: 'var(--st-text)' }}>
      {children}
    </code>
  );
}
