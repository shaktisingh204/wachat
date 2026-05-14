import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gauge } from 'lucide-react';
import { SettingsTabs } from '../_components/settings-tabs';

export const metadata = { title: 'Settings — Rate Limits — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Gauge className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Settings — Rate Limits</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a sending profile and let SabWa pace outbound traffic to keep your personal number safe.
          </p>
        </div>
      </div>
      <SettingsTabs />
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Choose between <strong>safe</strong>, <strong>normal</strong>, and <strong>aggressive</strong> profiles and let warmup mode ramp new sessions over 7 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li><strong>Safe</strong> profile: 8/min with ±4s jitter, capped at 500/day.</li>
            <li><strong>Normal</strong> profile: 15/min with ±3s jitter, capped at 2,000/day.</li>
            <li><strong>Aggressive</strong> profile: 30/min with ±2s jitter, capped at 10,000/day (with warning).</li>
            <li>Per-rule overrides for individual campaigns or recipients.</li>
            <li>7-day warmup mode — new sessions ramp linearly from 5 to 30 msgs/min.</li>
            <li>Velocity and diversity guards auto-pause if limits are exceeded.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
