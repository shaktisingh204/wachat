'use client';

import { Button, Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle, Input, Label } from '@/components/sabcrm/20ui/compat';
import { Key, BookOpen, Webhook, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function DeveloperOptions() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-[var(--st-text)]" /> Developer Options
          </CardTitle>
          <CardDescription>
            Proprietary access for programmatic URL shortening.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key (Read-only)</Label>
            <div className="flex gap-2">
              <Input id="apiKey" name="apiKey" value="sk_live_********************************" disabled />
              <Button type="button" variant="outline" disabled>
                Regenerate
              </Button>
            </div>
            <p className="text-xs text-[var(--st-text-secondary)]">
              API access for creating short links is currently in closed beta.
            </p>
          </div>
        </CardBody>
        <CardFooter>
          <Button type="button" variant="outline" disabled>
            <BookOpen className="mr-2 h-4 w-4" /> View API Docs
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-[var(--st-text)]" /> Webhooks
          </CardTitle>
          <CardDescription>
            Receive real-time notifications for link clicks and system events.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-[var(--st-text-secondary)]">
            Configure webhook endpoints to get real-time analytics data whenever someone clicks your shortened URLs or when link statuses change.
          </p>
        </CardBody>
        <CardFooter>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/dashboard/url-shortener/settings/webhooks">
              Manage Webhooks <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
