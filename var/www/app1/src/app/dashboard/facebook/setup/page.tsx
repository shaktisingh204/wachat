
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Wrench } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Marketing API Setup Guide | Wachat',
};

export default function MarketingApiSetupPage() {
  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
            <Wrench className="h-8 w-8"/>
            Marketing API Setup Guide
        </h1>
        <p className="text-muted-foreground mt-2">
          A step-by-step guide to connecting your business to the Meta Marketing API.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phase 1: Meta App Setup & Review</CardTitle>
          <CardDescription>
            Prepare your Meta App with the necessary products and permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>Create a new Meta App at <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary underline">developers.facebook.com</a>.</li>
            <li>In your App's dashboard, add the required products: <strong>Marketing API</strong>, <strong>Business Management</strong>, <strong>Pages API</strong>, and optionally <strong>Instagram Graph API</strong>.</li>
            <li>Go to the "App Review" section and request "Standard Access" for the following permissions:
                <ul className="list-disc pl-6 mt-2">
                    <li><code>ads_management</code></li>
                    <li><code>business_management</code></li>
                    <li><code>pages_show_list</code></li>
                    <li><code>pages_read_engagement</code></li>
                    <li>Optional: <code>catalog_management</code>, <code>leads_retrieval</code>, <code>ads_read</code></li>
                </ul>
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Phase 2: Generate a Permanent API Token</CardTitle>
          <CardDescription>
            You must generate a non-expiring token using a System User for server-to-server calls.
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
              Click <strong>Add Assets</strong>. Assign your App, Ad Account, and Facebook Page to this System User with <strong>Full Control</strong> permissions.
            </li>
            <li>
              With the System User selected, click{' '}
              <strong>Generate new token</strong>.
            </li>
            <li>Select your App and choose a <strong>Never</strong> expiring token.</li>
            <li>Grant the same permissions you requested for App Review (e.g., `ads_management`, `business_management`).</li>
            <li>Click <strong>Generate Token</strong> and copy it securely. You will need this for the next steps in our platform.</li>
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
          <CardTitle>Phase 3: Connect to Wachat</CardTitle>
          <CardDescription>
            Enter your Ad Account ID and Page ID in the settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Navigate to the <strong>Settings &rarr; Marketing</strong> tab in Wachat. Paste your <strong>Ad Account ID</strong> (e.g., `act_12345`) and your <strong>Facebook Page ID</strong> into the respective fields and save. Your access token is already saved with your project, so you don't need to re-enter it.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
