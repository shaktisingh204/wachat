'use client';

import {
  Button,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Field,
  Input,
} from '@/components/sabcrm/20ui';
import { Key, BookOpen, Webhook, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function DeveloperOptions() {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" aria-hidden="true" /> Developer Options
          </CardTitle>
          <CardDescription>
            Proprietary access for programmatic URL shortening.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <Field
            label="API Key (Read-only)"
            help="API access for creating short links is currently in closed beta."
          >
            <div className="flex gap-2">
              <Input
                id="apiKey"
                name="apiKey"
                value="sk_live_********************************"
                readOnly
                disabled
              />
              <Button type="button" variant="outline" disabled>
                Regenerate
              </Button>
            </div>
          </Field>
        </CardBody>
        <CardFooter>
          <Button type="button" variant="outline" iconLeft={BookOpen} disabled>
            View API Docs
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" aria-hidden="true" /> Webhooks
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
          <Button
            type="button"
            variant="outline"
            iconRight={ArrowRight}
            className="w-full sm:w-auto"
            onClick={() => router.push('/dashboard/url-shortener/settings/webhooks')}
          >
            Manage Webhooks
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
