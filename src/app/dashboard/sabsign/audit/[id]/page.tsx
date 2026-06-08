'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, History, Fingerprint } from 'lucide-react';
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

export default function AuditTrailDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  return (
    <main className="flex w-full max-w-4xl flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabSign · audit trail</PageEyebrow>
          <PageTitle>Envelope {id}</PageTitle>
          <PageDescription>
            A tamper-evident record of every view, signature, and delivery for
            this envelope.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            asChild
            variant="ghost"
            size="sm"
          >
            <Link href="/dashboard/sabsign/audit">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to audit trail
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <Card variant="outlined" padding="none">
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Fingerprint
                className="h-4 w-4 text-[var(--st-accent)]"
                aria-hidden="true"
              />
              Event history
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody>
          <EmptyState
            icon={History}
            tone="info"
            title="No audit events for this envelope yet"
            description="Once activity is recorded, each step in the signing lifecycle will appear here as a verifiable, time-stamped entry."
            action={
              <Button
                asChild
                variant="primary"
                size="sm"
              >
                <Link href="/dashboard/sabsign/audit">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  View all audit events
                </Link>
              </Button>
            }
          />
        </CardBody>
      </Card>
    </main>
  );
}
