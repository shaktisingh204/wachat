import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Megaphone } from 'lucide-react';

export const metadata = { title: 'Bulk Sender — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Megaphone className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Bulk Sender</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            A guided wizard for high-volume sends &mdash; audience, compose, review, run &mdash; with anti-ban guardrails built in.
          </p>
        </div>
      </div>
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
        <strong>Ban risk warning.</strong> Bulk sending on a personal WhatsApp account can get the number banned. Mandatory rate limits apply: hard cap of 30 messages/minute (default 8), a minimum 4-second jitter between sends, and auto-pause if presence drops or three consecutive sends fail. Plan-gated caps: 1,000 recipients/campaign on Free, 10,000 on Pro.
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Four-step wizard: pick audience, compose with variables, review estimated risk, then run with live controls.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Audience: paste numbers, upload CSV, pick by label/category, or pull from group members.</li>
            <li>Compose: template picker with variable mapping (<code>{'{{name}}'}</code>, <code>{'{{firstName}}'}</code>, <code>{'{{custom1}}'}</code>) and sample-row preview.</li>
            <li>Configurable send rate (msgs/min) with randomized humanization delay (&plusmn;X seconds).</li>
            <li>Media attach and A/B variant per campaign.</li>
            <li>Review step shows estimated duration, ban-risk score, and an &ldquo;I understand&rdquo; confirmation.</li>
            <li>Run view: live progress bar, per-recipient status, pause / resume / abort controls.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
