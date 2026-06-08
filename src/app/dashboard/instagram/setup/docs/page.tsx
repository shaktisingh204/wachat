'use client';

import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from '@/components/sabcrm/20ui';
import Link from 'next/link';
import { ChevronLeft, KeyRound, ListChecks, ShieldAlert } from 'lucide-react';

const PREREQUISITES = [
  'A Meta developer account.',
  'A Meta app.',
  'A Facebook Page connected to your Instagram Business account.',
  'A System User with admin access to your Business Portfolio.',
];

const TOKEN_STEPS = [
  <>Go to <strong>Meta Business Settings</strong> → <strong>Users</strong> → <strong>System Users</strong>.</>,
  'Select an existing System User with the admin role, or create a new one.',
  <>Click <strong>Add Assets</strong> and assign your app and Facebook Page to this System User with <strong>Full Control</strong>.</>,
  <>With the System User selected, click <strong>Generate new token</strong>.</>,
  'Select your app from the dropdown.',
  <>For token expiration, choose <strong>Never</strong> so service is uninterrupted.</>,
  'Under permissions, select everything related to pages_*, instagram_*, and business_management.',
  <>Click <strong>Generate token</strong> and copy it immediately.</>,
];

export default function ManualInstagramSetupDocsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 pt-6 pb-10">
      <PageHeader>
        <PageHeaderHeading>
          <PageDescription>Instagram · Setup</PageDescription>
          <PageTitle>Manual setup guide</PageTitle>
          <PageDescription>
            For advanced users who connect an Instagram Business account by providing credentials directly.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button asChild variant="ghost">
            <Link href="/dashboard/instagram/setup">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Back to setup
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <Card variant="outlined" padding="none">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
            Prerequisites
          </CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="flex flex-col gap-2">
            {PREREQUISITES.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-[var(--st-text)]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--st-accent)]" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card variant="outlined" padding="none">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Badge tone="accent">Step 1</Badge>
            Find your IDs
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--st-text)]">Facebook Page ID</p>
            <p className="mt-1 max-w-[65ch] text-sm text-[var(--st-text-secondary)]">
              Open your Facebook Page, go to About, then Page transparency. Your Page ID is listed there.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--st-text)]">Ad Account ID</p>
            <p className="mt-1 max-w-[65ch] text-sm text-[var(--st-text-secondary)]">
              Open Meta Ads Manager. The Ad Account ID (for example, act_12345...) appears in the URL and the account dropdown.
            </p>
          </div>
        </CardBody>
      </Card>

      <Card variant="outlined" padding="none">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Badge tone="accent">Step 2</Badge>
            <KeyRound className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
            Generate a permanent access token
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <p className="max-w-[65ch] text-sm text-[var(--st-text-secondary)]">
            This is the most important step. Generate a non-expiring token using a System User.
          </p>
          <ol className="flex flex-col gap-2.5">
            {TOKEN_STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-[var(--st-text)]">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--st-accent-soft)] text-[11px] font-semibold text-[var(--st-accent)]"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span className="max-w-[60ch]">{step}</span>
              </li>
            ))}
          </ol>
          <Callout tone="danger" title="Store your token securely" icon={ShieldAlert}>
            The permanent access token works like a password. Keep it private and never share it.
          </Callout>
        </CardBody>
      </Card>

      <Card variant="outlined" padding="none">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Badge tone="accent">Step 3</Badge>
            Connect to SabNode
          </CardTitle>
        </CardHeader>
        <CardBody>
          <p className="max-w-[65ch] text-sm text-[var(--st-text)]">
            Go to the{' '}
            <Link
              href="/dashboard/instagram/setup"
              className="text-[var(--st-accent)] underline-offset-2 hover:underline"
            >
              setup page
            </Link>
            , open the manual setup dialog, and paste your credentials into the matching fields.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
