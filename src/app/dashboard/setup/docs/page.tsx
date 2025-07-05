
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Manual Setup Guide | SabNode',
};

export default function ManualSetupDocsPage() {
  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">
      <div>
        <Button variant="ghost" asChild className="mb-4 -ml-4">
          <Link href="/dashboard/setup">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Setup Options
          </Link>
        </Button>
        <h1 className="text-3xl font-bold font-headline">Manual Setup Guide</h1>
        <p className="text-muted-foreground mt-2">
          This guide is for advanced users who want to connect their WhatsApp
          Business Account by providing credentials directly.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prerequisites</CardTitle>
          <CardDescription>
            Before you begin, ensure you have the following set up in your Meta
            Business Portfolio:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>A Meta Developer Account.</li>
            <li>
              A Meta App with the <strong>WhatsApp Business</strong> product
              added.
            </li>
            <li>A verified WhatsApp Business Account (WABA).</li>
            <li>
              A <strong>System User</strong> with Admin access to your Business
              Portfolio.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Find Your IDs</CardTitle>
          <CardDescription>
            You'll need two IDs to start: your WhatsApp Business Account ID and
            your App ID.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold">WhatsApp Business Account (WABA) ID</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Navigate to your Meta App's dashboard. Under the WhatsApp
              product, go to <strong>API Setup</strong>. Your WABA ID will be
              listed there.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">App ID</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your App ID is visible at the top of your Meta App's dashboard at
              all times.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 2: Generate a Permanent Access Token</CardTitle>
          <CardDescription>
            This is the most critical step. You must generate a non-expiring
            token using a System User.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>
              Go to your <strong>Meta Business Settings</strong> &rarr;{' '}
              <strong>Users</strong> &rarr; <strong>System Users</strong>.
            </li>
            <li>
              Select an existing System User (with Admin role) or create a new one.
            </li>
            <li>
              Click <strong>Add Assets</strong>. In the popup, assign your
              WhatsApp-enabled App and your WABA to this System User. Grant them{' '}
              <strong>Full Control</strong> permissions for both.
            </li>
            <li>
              With the System User selected, click{' '}
              <strong>Generate new token</strong>.
            </li>
            <li>Select your App from the dropdown menu.</li>
            <li>
              For Token Expiration, select <strong>Never</strong>. This is essential for uninterrupted service.
            </li>
            <li>
              Under Permissions, make sure to check both{' '}
              <code>whatsapp_business_management</code> and{' '}
              <code>whatsapp_business_messaging</code>.
            </li>
            <li>Click <strong>Generate Token</strong> and copy it immediately. You will not be able to see it again.</li>
          </ol>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Important: Store Your Token Securely</AlertTitle>
            <AlertDescription>
              The permanent access token is like a password. Treat it securely
              and do not share it. If you lose it, you will need to revoke the old one and generate a new one.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

       <Card>
        <CardHeader>
          <CardTitle>Step 3: Connect to SabNode</CardTitle>
          <CardDescription>
            Enter the credentials you've collected into the manual setup dialog.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Go back to the{' '}
            <Link href="/dashboard/setup" className="text-primary hover:underline">
              Setup Page
            </Link>
            , open the "Manual Setup" dialog, and paste your{' '}
            <strong>WABA ID</strong>, <strong>App ID</strong>, and{' '}
            <strong>Permanent Access Token</strong> into the respective fields. Click "Create Project" to complete the connection.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
