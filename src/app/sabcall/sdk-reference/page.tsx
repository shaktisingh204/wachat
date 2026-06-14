import * as React from 'react';
import {
  Card,
  Badge,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';

const CODE_CLASS =
  'overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-subtle)] p-[var(--st-space-4)] font-mono text-[13px] leading-relaxed text-[var(--st-text)]';

type Endpoint = {
  method: 'GET' | 'POST';
  path: string;
  summary: string;
  params: string;
  response: string;
};

const ENDPOINTS: Endpoint[] = [
  {
    method: 'POST',
    path: '/api/v1/sabcall/calls',
    summary: 'Place an outbound call.',
    params: `{
  "projectId": "<project id>",
  "to": "+15551234567",
  "callerId": "+15557654321"   // optional
}`,
    response: `{ "channelId": "1718000000.42" }`,
  },
  {
    method: 'GET',
    path: '/api/v1/sabcall/calls?projectId=&limit=',
    summary: 'List recent calls for a project.',
    params: `projectId   required   project id
limit       optional   max rows to return`,
    response: `{ "calls": [ /* call records */ ] }`,
  },
  {
    method: 'GET',
    path: '/api/v1/sabcall/contacts?projectId=&q=&limit=',
    summary: 'Search / list contacts for a project.',
    params: `projectId   required   project id
q           optional   search query
limit       optional   max rows to return`,
    response: `{ "contacts": [ /* contact records */ ] }`,
  },
  {
    method: 'POST',
    path: '/api/v1/sabcall/contacts',
    summary: 'Create a contact.',
    params: `{
  "projectId": "<project id>",
  "name": "Ada Lovelace",
  "phone": "+15551234567",
  "email": "ada@example.com",   // optional
  "company": "Analytical Inc",  // optional
  "vip": true                    // optional
}`,
    response: `{ "id": "<contact id>" }`,
  },
];

const SDK_SNIPPET = `import { createSabCallClient } from '@/lib/sabcall/sdk';

const client = createSabCallClient({
  baseUrl: 'https://app.sabnode.com',
  apiKey: process.env.SABCALL_API_KEY!, // calls:read / calls:write scopes
});

// Place an outbound call
const { channelId } = await client.placeCall(projectId, '+15551234567');

// List recent calls
const { calls } = await client.listCalls(projectId, { limit: 50 });

// Search contacts
const { contacts } = await client.listContacts(projectId, { q: 'ada' });

// Create a contact
const { id } = await client.createContact(projectId, {
  name: 'Ada Lovelace',
  phone: '+15551234567',
  vip: true,
});`;

const CLI_SNIPPET = `# Configure once
export SABCALL_API_BASE="https://app.sabnode.com"
export SABCALL_API_KEY="sk_live_…"

# Place an outbound call
node scripts/sabcall-cli.mjs place-call <projectId> +15551234567 [callerId]

# List recent calls
node scripts/sabcall-cli.mjs list-calls <projectId> [limit]

# Search contacts
node scripts/sabcall-cli.mjs list-contacts <projectId> [q]

# Create a contact
node scripts/sabcall-cli.mjs create-contact <projectId> "Ada Lovelace" +15551234567 [email]`;

const METHOD_TONE: Record<Endpoint['method'], React.ComponentProps<typeof Badge>['tone']> = {
  GET: 'info',
  POST: 'success',
};

export default function SabCallSdkReferencePage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabCall</PageEyebrow>
          <PageTitle>SDK &amp; API reference</PageTitle>
          <PageDescription>
            Place calls and manage contacts from your own code via the SabCall public REST API, the
            TypeScript SDK, or the CLI.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <Card variant="outlined" className="flex flex-col gap-[var(--st-space-3)]">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-[var(--st-text)]">Authentication</h2>
          <p className="text-sm text-[var(--st-text-secondary)]">
            Every request is authenticated with a SabNode API key passed as a Bearer token. Read
            endpoints require the <code className="font-mono">calls:read</code> scope; write
            endpoints require <code className="font-mono">calls:write</code>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="info" kind="outline" className="font-mono">
            calls:read
          </Badge>
          <Badge tone="success" kind="outline" className="font-mono">
            calls:write
          </Badge>
        </div>
        <pre className={CODE_CLASS}>{'Authorization: Bearer <SabNode API key>'}</pre>
      </Card>

      <section aria-label="REST endpoints" className="flex flex-col gap-[var(--st-space-4)]">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-[var(--st-text)]">REST endpoints</h2>
          <p className="text-sm text-[var(--st-text-secondary)]">
            Base URL: <code className="font-mono">https://&lt;your-sabnode-host&gt;</code>
          </p>
        </div>

        {ENDPOINTS.map((ep) => (
          <Card
            key={`${ep.method} ${ep.path}`}
            variant="outlined"
            className="flex flex-col gap-[var(--st-space-3)]"
          >
            <div className="flex flex-wrap items-center gap-[var(--st-space-2)]">
              <Badge tone={METHOD_TONE[ep.method]} className="font-mono">
                {ep.method}
              </Badge>
              <span className="font-mono text-sm text-[var(--st-text)]">{ep.path}</span>
            </div>
            <p className="text-sm text-[var(--st-text-secondary)]">{ep.summary}</p>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                {ep.method === 'GET' ? 'Query params' : 'Request body'}
              </span>
              <pre className={CODE_CLASS}>{ep.params}</pre>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                Response
              </span>
              <pre className={CODE_CLASS}>{ep.response}</pre>
            </div>
          </Card>
        ))}
      </section>

      <Card variant="outlined" className="flex flex-col gap-[var(--st-space-3)]">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-[var(--st-text)]">TypeScript SDK</h2>
          <p className="text-sm text-[var(--st-text-secondary)]">
            Isomorphic, zero-dependency client. Import it from{' '}
            <code className="font-mono">@/lib/sabcall/sdk</code> in app code, route handlers, or any
            external project.
          </p>
        </div>
        <pre className={CODE_CLASS}>{SDK_SNIPPET}</pre>
      </Card>

      <Card variant="outlined" className="flex flex-col gap-[var(--st-space-3)]">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-[var(--st-text)]">CLI</h2>
          <p className="text-sm text-[var(--st-text-secondary)]">
            A standalone Node script (<code className="font-mono">scripts/sabcall-cli.mjs</code>)
            that calls the REST API directly — no install, just <code className="font-mono">node</code>{' '}
            and the two env vars.
          </p>
        </div>
        <pre className={CODE_CLASS}>{CLI_SNIPPET}</pre>
      </Card>
    </main>
  );
}
