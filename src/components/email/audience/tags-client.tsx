'use client';

import { useState, useEffect } from 'react';
import { Tag } from 'lucide-react';
import { PageHeader, PageHeading, PageTitle, PageDescription, Card, CardHeader, CardTitle, CardDescription, CardBody, Table, THead, Tr, Th, TBody, Td, Skeleton, toast } from '@/components/sabcrm/20ui';
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
        toast({ title: 'Failed to load tags', description: res.error, variant: 'destructive' });
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>
            <span className="inline-flex items-center gap-3">
              <Tag className="h-6 w-6" /> Tags
            </span>
          </PageTitle>
          <PageDescription>
            Organize subscribers with tags that drive segments and journey triggers.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>All Tags</CardTitle>
          <CardDescription>A list of all tags currently assigned to your audience.</CardDescription>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="space-y-2">
               <Skeleton className="h-10 w-full" />
               <Skeleton className="h-10 w-full" />
               <Skeleton className="h-10 w-full" />
            </div>
          ) : tags.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--st-text-secondary)]">
              No tags found. Apply tags to subscribers to see them here.
            </div>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Tag Name</Th>
                  <Th className="w-[200px] text-right">Subscribers</Th>
                </Tr>
              </THead>
              <TBody>
                {tags.map((tag) => (
                  <Tr key={tag.name}>
                    <Td className="font-medium">{tag.name}</Td>
                    <Td className="text-right tabular-nums">{tag.count}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
