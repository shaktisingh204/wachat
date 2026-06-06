'use client';

import { Alert, AlertDescription, AlertTitle, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, PageDescription, PageHeader, PageHeading, PageTitle } from '@/components/sabcrm/20ui/compat';
import Link from 'next/link';
import { ChevronLeft, AlertCircle } from 'lucide-react';

export default function ManualInstagramSetupDocsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button variant="ghost" asChild className="mb-4 -ml-4">
          <Link href="/dashboard/instagram/setup">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Setup Options
          </Link>
        </Button>
        <PageHeader>
          <PageHeading>
            <PageTitle>Manual Setup Guide for Instagram</PageTitle>
            <PageDescription>
              This guide is for advanced users who want to connect their Instagram Business
              Account by providing credentials directly.
            </PageDescription>
          </PageHeading>
        </PageHeader>
      </div>

      <Card className="p-6">
        <CardHeader>
          <CardTitle>Prerequisites</CardTitle>
          <CardDescription>
            Before you begin, ensure you have the following set up in your Meta Business Suite:
          </CardDescription>
        </CardHeader>
        <CardBody>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>A Meta Developer Account.</li>
            <li>A Meta App.</li>
            <li>A Facebook Page connected to your Instagram Business Account.</li>
            <li>
              A <strong>System User</strong> with Admin access to your Business Portfolio.
            </li>
          </ul>
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader>
          <CardTitle>Step 1: Find Your IDs</CardTitle>
          <CardDescription>
            You&apos;ll need your Facebook Page ID and your Ad Account ID.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <h3 className="text-[var(--st-text)]">Facebook Page ID</h3>
            <p className="text-sm text-[var(--st-text-secondary)] mt-1">
              Go to your Facebook Page. Click on &ldquo;About&rdquo; and then &ldquo;Page
              Transparency&rdquo;. Your Page ID will be listed there.
            </p>
          </div>
          <div>
            <h3 className="text-[var(--st-text)]">Ad Account ID</h3>
            <p className="text-sm text-[var(--st-text-secondary)] mt-1">
              Go to your Meta Ads Manager. The Ad Account ID (e.g., `act_12345...`) will be
              visible in the URL or the account dropdown menu.
            </p>
          </div>
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader>
          <CardTitle>Step 2: Generate a Permanent Access Token</CardTitle>
          <CardDescription>
            This is the most critical step. You must generate a non-expiring token using a System
            User.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>
              Go to your <strong>Meta Business Settings</strong> &rarr; <strong>Users</strong>{' '}
              &rarr; <strong>System Users</strong>.
            </li>
            <li>Select an existing System User (with Admin role) or create a new one.</li>
            <li>
              Click <strong>Add Assets</strong>. In the popup, assign your App and your Facebook
              Page to this System User. Grant them <strong>Full Control</strong> permissions for
              both.
            </li>
            <li>
              With the System User selected, click <strong>Generate new token</strong>.
            </li>
            <li>Select your App from the dropdown menu.</li>
            <li>
              For Token Expiration, select <strong>Never</strong>. This is essential for
              uninterrupted service.
            </li>
            <li>
              Under Permissions, select all permissions related to `pages_...`, `instagram_...`,
              and `business_management`.
            </li>
            <li>
              Click <strong>Generate Token</strong> and copy it immediately.
            </li>
          </ol>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Important: Store Your Token Securely</AlertTitle>
            <AlertDescription>
              The permanent access token is like a password. Treat it securely and do not share
              it.
            </AlertDescription>
          </Alert>
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader>
          <CardTitle>Step 3: Connect to SabNode</CardTitle>
          <CardDescription>
            Enter the credentials you&apos;ve collected into the manual setup dialog.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <p className="text-sm">
            Go back to the{' '}
            <Link href="/dashboard/instagram/setup" className="text-[var(--st-text)] underline">
              Setup Page
            </Link>
            , open the &ldquo;Manual Setup&rdquo; dialog, and paste your credentials into the
            respective fields.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
