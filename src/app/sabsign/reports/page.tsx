'use client';

import * as React from 'react';
import {
  BarChart3,
  Clock,
  CheckCircle2,
  FileSignature,
  Download,
} from 'lucide-react';
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

export default function ReportsPage() {
  return (
    <main className="flex w-full max-w-6xl flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabSign</PageEyebrow>
          <PageTitle>Analytics and reports</PageTitle>
          <PageDescription>
            Measure completion rates, signing turnaround, and where envelopes
            stall across your workspace.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="outline" size="sm" iconLeft={Download} disabled>
            Export report
          </Button>
        </PageActions>
      </PageHeader>

      <section
        aria-label="Signing overview"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <StatCard label="Sent" value="0" icon={FileSignature} accent="#6366f1" />
        <StatCard label="Completed" value="0" icon={CheckCircle2} />
        <StatCard label="Completion rate" value="0%" icon={BarChart3} />
        <StatCard label="Avg. time to sign" value="—" icon={Clock} />
      </section>

      <Card variant="outlined" padding="none">
        <CardHeader>
          <CardTitle>Signing activity</CardTitle>
        </CardHeader>
        <CardBody>
          <EmptyState
            icon={BarChart3}
            tone="info"
            title="No activity to report yet"
            description="Send your first envelope and SabSign will chart completion rates, turnaround time, and recipient drop-off here."
            action={
              <Button variant="primary" size="sm" iconLeft={FileSignature}>
                Send an envelope
              </Button>
            }
          />
        </CardBody>
      </Card>
    </main>
  );
}
