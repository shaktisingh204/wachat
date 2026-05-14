import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FolderTree } from 'lucide-react';

export const metadata = { title: 'Group Categories — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <FolderTree className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Group Categories</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Organize WhatsApp groups into custom categories for faster triage and bulk operations.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Full CRUD for categories with drag-and-drop reorder and bulk-assign across groups.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Create, rename, recolor, and delete categories.</li>
            <li>Drag-and-drop to reorder how categories appear in the Groups strip.</li>
            <li>Bulk-assign chats to a category in a single action.</li>
            <li>Default starter set: Family, Work, Communities, Other.</li>
            <li>Per-category counts so empty categories are easy to spot.</li>
            <li>Quick filter into Groups page by selecting a category.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
