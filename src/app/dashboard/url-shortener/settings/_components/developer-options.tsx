'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
} from '@/components/zoruui';
import { Key, BookOpen, Webhook, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function DeveloperOptions() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-zoru-ink" /> Developer Options
          </ZoruCardTitle>
          <ZoruCardDescription>
            Proprietary access for programmatic URL shortening.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key (Read-only)</Label>
            <div className="flex gap-2">
              <Input id="apiKey" name="apiKey" value="sk_live_********************************" disabled />
              <Button type="button" variant="outline" disabled>
                Regenerate
              </Button>
            </div>
            <p className="text-xs text-zoru-ink-muted">
              API access for creating short links is currently in closed beta.
            </p>
          </div>
        </ZoruCardContent>
        <ZoruCardFooter>
          <Button type="button" variant="outline" disabled>
            <BookOpen className="mr-2 h-4 w-4" /> View API Docs
          </Button>
        </ZoruCardFooter>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-zoru-ink" /> Webhooks
          </ZoruCardTitle>
          <ZoruCardDescription>
            Receive real-time notifications for link clicks and system events.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <p className="text-sm text-zoru-ink-muted">
            Configure webhook endpoints to get real-time analytics data whenever someone clicks your shortened URLs or when link statuses change.
          </p>
        </ZoruCardContent>
        <ZoruCardFooter>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/dashboard/url-shortener/settings/webhooks">
              Manage Webhooks <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </ZoruCardFooter>
      </Card>
    </div>
  );
}
