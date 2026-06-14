'use client';

import * as React from 'react';
import { Send, Users, FileSpreadsheet, FileSignature } from 'lucide-react';
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
} from '@/components/sabcrm/20ui';

const STEPS = [
  {
    icon: FileSignature,
    title: 'Pick a template',
    desc: 'Choose a reusable document with signer roles already defined.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Upload recipients',
    desc: 'Import a CSV of names and emails to map onto each signer role.',
  },
  {
    icon: Send,
    title: 'Send in one batch',
    desc: 'Generate a personalised envelope for every recipient at once.',
  },
];

export default function BulkSendPage() {
  return (
    <main className="flex w-full max-w-6xl flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabSign</PageEyebrow>
          <PageTitle>Bulk send</PageTitle>
          <PageDescription>
            Send the same document to hundreds of recipients from one template
            and a recipient list.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" size="sm" iconLeft={Send} disabled>
            Start a batch
          </Button>
        </PageActions>
      </PageHeader>

      <section
        aria-label="How bulk send works"
        className="grid grid-cols-1 gap-3 md:grid-cols-3"
      >
        {STEPS.map(({ icon: Icon, title, desc }, i) => (
          <Card key={title} variant="outlined" padding="md">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-xs font-medium tabular-nums text-[var(--st-text-tertiary)]">
                Step {i + 1}
              </span>
            </div>
            <h3 className="mt-3 text-sm font-medium text-[var(--st-text)]">
              {title}
            </h3>
            <p className="mt-1 text-sm text-[var(--st-text-secondary)]">{desc}</p>
          </Card>
        ))}
      </section>

      <Card variant="outlined" padding="none">
        <CardHeader>
          <CardTitle>Recent batches</CardTitle>
        </CardHeader>
        <CardBody>
          <EmptyState
            icon={Users}
            tone="info"
            title="No bulk sends yet"
            description="Bulk send is coming to SabSign. When it is live, your batches and their per-recipient signing status will appear here."
            action={
              <Button variant="outline" size="sm">
                Notify me when it is ready
              </Button>
            }
          />
        </CardBody>
      </Card>
    </main>
  );
}
