import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Webhook } from 'lucide-react';

export const metadata = { title: 'Webhooks — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Webhook className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Outbound webhook endpoints that fan SabWa events out to your own systems in real time.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Register HTTPS endpoints, subscribe to the events you care about, and replay failed deliveries with one click.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Register and manage outbound webhook endpoints per session.</li>
            <li>Subscribe to <code>message.received</code> and <code>message.status</code> events.</li>
            <li>Subscribe to <code>group.joined</code> and <code>session.disconnected</code> events.</li>
            <li>Subscribe to <code>scheduled.sent</code> for scheduler completions.</li>
            <li>HMAC signing secret per endpoint for verification.</li>
            <li>Delivery log with automatic retry and manual replay.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
