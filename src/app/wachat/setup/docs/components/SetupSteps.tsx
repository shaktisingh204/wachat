import React from 'react';
import Link from 'next/link';
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Alert,
} from '@/components/sabcrm/20ui';

export function PrerequisitesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prerequisites</CardTitle>
        <CardDescription>
          Before you begin, ensure you have the following set up in your Meta Business Portfolio:
        </CardDescription>
      </CardHeader>
      <CardBody>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>A Meta Developer Account.</li>
          <li>A Meta App with the <strong>WhatsApp Business</strong> product added.</li>
          <li>A verified WhatsApp Business Account (WABA).</li>
          <li>A <strong>System User</strong> with Admin access to your Business Portfolio.</li>
        </ul>
      </CardBody>
    </Card>
  );
}

export function FindIdsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1: Find Your IDs</CardTitle>
        <CardDescription>
          You'll need two IDs to start: your WhatsApp Business Account ID and your App ID.
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        <div>
          <h3 className="font-semibold">WhatsApp Business Account (WABA) ID</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--st-text-secondary)' }}>
            Navigate to your Meta App's dashboard. Under the WhatsApp product, go to <strong>API Setup</strong>. Your WABA ID will be listed there.
          </p>
        </div>
        <div>
          <h3 className="font-semibold">App ID</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--st-text-secondary)' }}>
            Your App ID is visible at the top of your Meta App's dashboard at all times.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

export function GenerateTokenCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2: Generate a Permanent Access Token</CardTitle>
        <CardDescription>
          This is the most critical step. You must generate a non-expiring token using a System User.
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        <ol className="list-decimal space-y-3 pl-5 text-sm">
          <li>Go to your <strong>Meta Business Settings</strong> &rarr; <strong>Users</strong> &rarr; <strong>System Users</strong>.</li>
          <li>Select an existing System User (with Admin role) or create a new one.</li>
          <li>Click <strong>Add Assets</strong>. In the popup, assign your WhatsApp-enabled App and your WABA to this System User. Grant them <strong>Full Control</strong> permissions for both.</li>
          <li>With the System User selected, click <strong>Generate new token</strong>.</li>
          <li>Select your App from the dropdown menu.</li>
          <li>For Token Expiration, select <strong>Never</strong>. This is essential for uninterrupted service.</li>
          <li>Under Permissions, make sure to check both <code>whatsapp_business_management</code> and <code>whatsapp_business_messaging</code>.</li>
          <li>Click <strong>Generate Token</strong> and copy it immediately. You will not be able to see it again.</li>
        </ol>
        <Alert tone="danger" title="Important: Store Your Token Securely">
          The permanent access token is like a password. Treat it securely and do not share it. If you lose it, you will need to revoke the old one and generate a new one.
        </Alert>
      </CardBody>
    </Card>
  );
}

export function ConnectToSabNodeCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 3: Connect to SabNode</CardTitle>
        <CardDescription>
          Enter the credentials you've collected into the manual setup dialog.
        </CardDescription>
      </CardHeader>
      <CardBody>
        <p className="text-sm">
          Go back to the{' '}
          <Link href="/wachat/setup" className="hover:underline" style={{ color: 'var(--st-text)' }}>
            Setup Page
          </Link>
          , open the "Manual Setup" dialog, and paste your{' '}
          <strong>WABA ID</strong>, <strong>App ID</strong>, and{' '}
          <strong>Permanent Access Token</strong> into the respective fields. Click "Create Project" to complete the connection.
        </p>
      </CardBody>
    </Card>
  );
}
