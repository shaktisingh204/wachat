'use client';

import { useState, useEffect } from 'react';
import { Database } from 'lucide-react';
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
  Badge,
  zoruToast,
} from '@/components/zoruui';
import { actionGetEmailFieldSchema, type CustomFieldDef } from '@/app/actions/email/audience.actions';

export function FieldsClient() {
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await actionGetEmailFieldSchema();
      if (res.ok) {
        setFields(res.data.fields);
      } else {
        zoruToast({ title: 'Failed to load fields schema', description: res.error, variant: 'destructive' });
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
              <Database className="h-6 w-6" /> Custom Fields
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Manage custom data fields for your subscribers.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Schema Definition</ZoruCardTitle>
          <ZoruCardDescription>Current custom fields configured for your account.</ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          {loading ? (
            <div className="space-y-2">
               <Skeleton className="h-10 w-full" />
               <Skeleton className="h-10 w-full" />
               <Skeleton className="h-10 w-full" />
            </div>
          ) : fields.length === 0 ? (
            <div className="py-8 text-center text-sm text-zoru-ink-muted">
              No custom fields defined.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field) => (
                  <TableRow key={field.key}>
                    <TableCell className="font-mono text-xs">{field.key}</TableCell>
                    <TableCell>
                       <Badge variant="secondary">{field.type}</Badge>
                    </TableCell>
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
