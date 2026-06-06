'use client';

import { useState, useEffect } from 'react';
import { Database } from 'lucide-react';
import { PageHeader, PageHeading, PageTitle, PageDescription, Card, CardHeader, CardTitle, CardDescription, CardBody, Table, THead, Tr, Th, TBody, Td, Skeleton, Badge, toast } from '@/components/sabcrm/20ui';
import { actionGetEmailFieldSchema } from '@/app/actions/email/audience.actions';
import type { CustomFieldDef } from '@/lib/rust-client/email-audience';

export function FieldsClient() {
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await actionGetEmailFieldSchema();
      if (res.ok) {
        setFields(res.data.fields);
      } else {
        toast({ title: 'Failed to load fields schema', description: res.error, variant: 'destructive' });
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
              <Database className="h-6 w-6" /> Custom Fields
            </span>
          </PageTitle>
          <PageDescription>
            Manage custom data fields for your subscribers.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Schema Definition</CardTitle>
          <CardDescription>Current custom fields configured for your account.</CardDescription>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="space-y-2">
               <Skeleton className="h-10 w-full" />
               <Skeleton className="h-10 w-full" />
               <Skeleton className="h-10 w-full" />
            </div>
          ) : fields.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--st-text-secondary)]">
              No custom fields defined.
            </div>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Key</Th>
                  <Th>Type</Th>
                </Tr>
              </THead>
              <TBody>
                {fields.map((field) => (
                  <Tr key={field.key}>
                    <Td className="font-mono text-xs">{field.key}</Td>
                    <Td>
                       <Badge variant="secondary">{field.type}</Badge>
                    </Td>
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
