import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Images } from 'lucide-react';

export const metadata = { title: 'Media Library — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Images className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Media Library</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Unified gallery of every media item sent or received in this session, with filters and bulk operations.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Browse, filter, and bulk-move media across the connected number — push to SabFiles or delete in one click.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Tabs for photos, videos, audio, docs, and voice notes.</li>
            <li>Filter by chat, date range, or sender.</li>
            <li>Bulk download selected media as an archive.</li>
            <li>Push selected media to SabFiles in one action.</li>
            <li>Bulk delete with confirmation.</li>
            <li>Per-item preview with source chat jump-link.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
