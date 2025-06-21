'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function CronLogsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Cron Job Logs</h1>
        <p className="text-muted-foreground">This feature has been disabled.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Log Monitoring Disabled</CardTitle>
          <CardDescription>
            All background job logging has been removed as per your request. This page is no longer active.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">The navigation link to this page has also been removed.</p>
        </CardContent>
      </Card>
    </div>
  );
}
