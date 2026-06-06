'use client';

import { useState, useEffect } from 'react';
import { Tag } from 'lucide-react';
import {
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Skeleton,
  zoruToast,
} from '@/components/sabcrm/20ui/compat';
import { actionListEmailTags } from '@/app/actions/email/audience.actions';
import type { TagWithCount } from '@/lib/rust-client/email-audience';

export function TagsClient() {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await actionListEmailTags();
      if (res.ok) {
        setTags(res.data.tags);
      } else {
        zoruToast({ title: 'Failed to load tags', description: res.error, variant: 'destructive' });
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-3">
              <Tag className="h-6 w-6" /> Tags
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Organize subscribers with tags that drive segments and journey triggers.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>All Tags</ZoruCardTitle>
          <ZoruCardDescription>A list of all tags currently assigned to your audience.</ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          {loading ? (
            <div className="space-y-2">
               <Skeleton className="h-10 w-full" />
               <Skeleton className="h-10 w-full" />
               <Skeleton className="h-10 w-full" />
            </div>
          ) : tags.length === 0 ? (
            <div className="py-8 text-center text-sm text-zoru-ink-muted">
              No tags found. Apply tags to subscribers to see them here.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag Name</TableHead>
                  <TableHead className="w-[200px] text-right">Subscribers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map((tag) => (
                  <TableRow key={tag.name}>
                    <TableCell className="font-medium">{tag.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{tag.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ZoruCardContent>
      </Card>
    </div>
  );
}
