'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Mail, Pencil, Archive } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Input, PageActions, PageDescription, PageHeader, PageHeading, PageTitle, Skeleton, Table, TBody, Td, Th, THead, Tr, toast } from '@/components/sabcrm/20ui/compat';
import {
  actionDeleteTransactionalTemplate,
  actionListTransactionalTemplates,
  actionUpdateTransactionalTemplate,
} from '@/app/actions/email/templates-transactional.actions';
import type { TransactionalTemplateDoc } from '@/lib/rust-client/email-templates-transactional';

export function TransactionalTemplatesClient() {
  const [items, setItems] = useState<TransactionalTemplateDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async (q?: string) => {
    setLoading(true);
    const res = await actionListTransactionalTemplates({ q, limit: 100 });
    if (res.ok) {
      setItems(res.data.items);
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const r = await actionDeleteTransactionalTemplate(id);
      if (r.ok) {
        toast.success('Template deleted');
        refresh(query);
      } else {
        toast.error(r.error);
      }
    });
  };

  const handleArchive = (item: TransactionalTemplateDoc) => {
    startTransition(async () => {
      const r = await actionUpdateTransactionalTemplate(item._id, { archived: !item.archived });
      if (r.ok) {
        toast.success(item.archived ? 'Unarchived' : 'Archived');
        refresh(query);
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <div className="zoruui space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Transactional templates</PageTitle>
          <PageDescription>
            Key-addressable templates rendered on demand — password resets, order confirmations, OTPs.
            Distinct from marketing templates.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button asChild>
            <Link href="/dashboard/email/templates/transactional/new">
              <Plus className="mr-2 h-4 w-4" />
              New template
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <Card className="p-4">
        <Input
          placeholder="Search by name or key..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => refresh(query)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') refresh(query);
          }}
        />
      </Card>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Mail className="h-8 w-8" />}
          title="No transactional templates"
          description="Create your first template to start sending triggered emails."
          action={
            <Button asChild>
              <Link href="/dashboard/email/templates/transactional/new">
                <Plus className="mr-2 h-4 w-4" />
                New template
              </Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Key</Th>
                <Th>Subject</Th>
                <Th>Vars</Th>
                <Th>Version</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {items.map((item) => (
                <Tr key={item._id}>
                  <Td className="font-medium">
                    <Link className="hover:underline" href={`/dashboard/email/templates/transactional/${item._id}`}>
                      {item.name}
                    </Link>
                    {item.archived && (
                      <Badge variant="outline" className="ml-2">
                        Archived
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    <code className="rounded bg-[color:var(--st-bg-muted)] px-1.5 py-0.5 text-xs">
                      {item.key}
                    </code>
                  </Td>
                  <Td className="max-w-md truncate">{item.subject}</Td>
                  <Td>{item.vars?.length ?? 0}</Td>
                  <Td>v{item.version}</Td>
                  <Td className="text-right">
                    <Button size="icon" variant="ghost" asChild>
                      <Link href={`/dashboard/email/templates/transactional/${item._id}`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleArchive(item)}
                      disabled={pending}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(item._id)}
                      disabled={pending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
