'use client';

import * as React from 'react';
import { Code2, KeyRound, Webhook, BookOpen } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Separator,
} from '@/components/sabcrm/20ui';

const CAPABILITIES = [
  {
    icon: KeyRound,
    title: 'API keys',
    desc: 'Issue scoped keys to send envelopes and read signing status programmatically.',
  },
  {
    icon: Webhook,
    title: 'Webhooks',
    desc: 'Receive real-time events when a document is viewed, signed, or completed.',
  },
  {
    icon: BookOpen,
    title: 'Reference',
    desc: 'REST endpoints for envelopes, templates, and the signing flow.',
  },
];

export default function ApiSettingsPage() {
  return (
    <main className="flex w-full max-w-6xl flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabSign</PageEyebrow>
          <PageTitle>Developer API</PageTitle>
          <PageDescription>
            Send envelopes, manage templates, and stream signing events directly
            from your own systems.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="outline" size="sm" iconLeft={BookOpen}>
            Read the docs
          </Button>
        </PageActions>
      </PageHeader>

      <section
        aria-label="What you can build"
        className="grid grid-cols-1 gap-3 md:grid-cols-3"
      >
        {CAPABILITIES.map(({ icon: Icon, title, desc }) => (
          <Card key={title} variant="outlined" padding="md">
            <span
              className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
              aria-hidden="true"
            >
              <Icon className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-medium text-[var(--st-text)]">{title}</h3>
            <p className="mt-1 text-sm text-[var(--st-text-secondary)]">{desc}</p>
          </Card>
        ))}
      </section>

      <Card variant="outlined" padding="none">
        <CardHeader>
          <CardTitle>Your API keys</CardTitle>
        </CardHeader>
        <Separator />
        <CardBody>
          <EmptyState
            icon={Code2}
            tone="info"
            title="No API keys yet"
            description="Programmatic access is rolling out for SabSign. Request early access to generate a key and start integrating."
            action={
              <Button variant="primary" size="sm" iconLeft={KeyRound}>
                Request early access
              </Button>
            }
          />
        </CardBody>
      </Card>
    </main>
  );
}
