import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookCopy } from 'lucide-react';

export const metadata = { title: 'Templates — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <BookCopy className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Reusable message templates with rich text, media, and variables — organized into searchable folders.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Saved templates you can pull into any composer, scheduler, or broadcast.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Rich-text body with inline media attachments.</li>
            <li>Variable placeholders using <code>{'{{vars}}'}</code> syntax.</li>
            <li>Category folders to organize templates by purpose.</li>
            <li>Fast search across template titles and bodies.</li>
            <li>Usage analytics showing how often each template is sent.</li>
            <li>Insert into composer in one click from anywhere.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
