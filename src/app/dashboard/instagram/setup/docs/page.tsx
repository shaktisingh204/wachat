'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/zoruui';
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
          <ZoruPageHeading>
            <ZoruPageTitle>Manual Setup Guide for Instagram</ZoruPageTitle>
            <ZoruPageDescription>
              This guide is for advanced users who want to connect their Instagram Business
              Account by providing credentials directly.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </PageHeader>
      </div>

      <Card className="p-6">
        <ZoruCardHeader>
          <ZoruCardTitle>Prerequisites</ZoruCardTitle>
          <ZoruCardDescription>
            Before you begin, ensure you have the following set up in your Meta Business Suite:
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>A Meta Developer Account.</li>
            <li>A Meta App.</li>
            <li>A Facebook Page connected to your Instagram Business Account.</li>
            <li>
              A <strong>System User</strong> with Admin access to your Business Portfolio.
            </li>
          </ul>
        </ZoruCardContent>
      </Card>

      <Card className="p-6">
        <ZoruCardHeader>
          <ZoruCardTitle>Step 1: Find Your IDs</ZoruCardTitle>
          <ZoruCardDescription>
            You&apos;ll need your Facebook Page ID and your Ad Account ID.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <div>
            <h3 className="text-zoru-ink">Facebook Page ID</h3>
            <p className="text-sm text-zoru-ink-muted mt-1">
              Go to your Facebook Page. Click on &ldquo;About&rdquo; and then &ldquo;Page
              Transparency&rdquo;. Your Page ID will be listed there.
            </p>
          </div>
          <div>
            <h3 className="text-zoru-ink">Ad Account ID</h3>
            <p className="text-sm text-zoru-ink-muted mt-1">
              Go to your Meta Ads Manager. The Ad Account ID (e.g., `act_12345...`) will be
              visible in the URL or the account dropdown menu.
            </p>
          </div>
        </ZoruCardContent>
      </Card>

      <Card className="p-6">
        <ZoruCardHeader>
          <ZoruCardTitle>Step 2: Generate a Permanent Access Token</ZoruCardTitle>
          <ZoruCardDescription>
            This is the most critical step. You must generate a non-expiring token using a System
            User.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
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
            <ZoruAlertTitle>Important: Store Your Token Securely</ZoruAlertTitle>
            <ZoruAlertDescription>
              The permanent access token is like a password. Treat it securely and do not share
              it.
            </ZoruAlertDescription>
          </Alert>
        </ZoruCardContent>
      </Card>

      <Card className="p-6">
        <ZoruCardHeader>
          <ZoruCardTitle>Step 3: Connect to SabNode</ZoruCardTitle>
          <ZoruCardDescription>
            Enter the credentials you&apos;ve collected into the manual setup dialog.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <p className="text-sm">
            Go back to the{' '}
            <Link href="/dashboard/instagram/setup" className="text-zoru-ink underline">
              Setup Page
            </Link>
            , open the &ldquo;Manual Setup&rdquo; dialog, and paste your credentials into the
            respective fields.
          </p>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
