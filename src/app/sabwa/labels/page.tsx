import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tag } from 'lucide-react';

export const metadata = { title: 'Labels — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Tag className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Labels</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Organise chats with named, colour-coded labels and slice your inbox by them on demand.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Full CRUD for labels plus chat assignment and inbox filtering, mirroring WhatsApp&apos;s native concept.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Create labels with a name and colour swatch.</li>
            <li>Rename, recolour, and delete existing labels.</li>
            <li>Assign one or more labels to any chat.</li>
            <li>Bulk-tag chats from the inbox selection toolbar.</li>
            <li>Filter the inbox by a single label or combination.</li>
            <li>Label-aware counts in the inbox sidebar.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
