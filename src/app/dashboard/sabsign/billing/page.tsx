'use client';

import * as React from 'react';
import { CreditCard, Gauge, FileSignature, Receipt } from 'lucide-react';
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
  StatCard,
} from '@/components/sabcrm/20ui';

export default function BillingPage() {
  return (
    <main className="flex w-full max-w-6xl flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabSign</PageEyebrow>
          <PageTitle>Billing and usage</PageTitle>
          <PageDescription>
            Track signature volume against your plan and review invoices for your
            e-signature workflows.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="outline" size="sm" iconLeft={Receipt}>
            View invoices
          </Button>
        </PageActions>
      </PageHeader>

      <section
        aria-label="Plan usage"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <StatCard
          label="Current plan"
          value="Business"
          icon={CreditCard}
          accent="#6366f1"
        />
        <StatCard
          label="Envelopes this month"
          value="0"
          icon={FileSignature}
          delta={{ value: 'of 500 included', tone: 'neutral' }}
        />
        <StatCard
          label="Plan utilisation"
          value="0%"
          icon={Gauge}
        />
      </section>

      <Card variant="outlined" padding="none">
        <CardHeader>
          <CardTitle>Usage and invoices</CardTitle>
        </CardHeader>
        <CardBody>
          <EmptyState
            icon={CreditCard}
            tone="info"
            title="Billing details are not available yet"
            description="Once your workspace starts sending envelopes, monthly usage, overage charges, and downloadable invoices will appear here."
            action={
              <Button variant="primary" size="sm">
                Contact sales
              </Button>
            }
          />
        </CardBody>
      </Card>
    </main>
  );
}
