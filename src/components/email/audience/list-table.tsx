'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Archive, MoreHorizontal, Pencil, Users } from 'lucide-react';
import { Badge, Button, Card, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, EmptyState, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import type { EmailListDoc } from '@/lib/rust-client/email-audience';

interface EmailListTableProps {
  lists: EmailListDoc[];
  onEdit: (list: EmailListDoc) => void;
  onArchive: (list: EmailListDoc) => void;
}

export function EmailListTable({ lists, onEdit, onArchive }: EmailListTableProps) {
  if (lists.length === 0) {
    return (
      <EmptyState
        icon={<Users />}
        title="No lists yet"
        description="Create your first audience list to start collecting subscribers."
      />
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <Table>
        <THead>
          <Tr>
            <Th>Name</Th>
            <Th>Subscribers</Th>
            <Th>Default sender</Th>
            <Th>Created</Th>
            <Th className="w-[60px]" />
          </Tr>
        </THead>
        <TBody>
          {lists.map((list) => (
            <Tr key={list._id}>
              <Td>
                <Link
                  href={`/dashboard/email/audience/lists/${list._id}`}
                  className="font-medium text-[var(--st-text)] hover:underline"
                >
                  {list.name}
                </Link>
                {list.description ? (
                  <p className="text-xs text-[var(--st-text-secondary)] truncate max-w-md">
                    {list.description}
                  </p>
                ) : null}
              </Td>
              <Td>
                <Badge variant="outline">{list.subscriberCount ?? 0}</Badge>
              </Td>
              <Td className="text-[var(--st-text-secondary)] text-sm">
                {list.defaultFromEmail ?? '—'}
              </Td>
              <Td className="text-[var(--st-text-secondary)] text-sm">
                {list.createdAt
                  ? formatDistanceToNow(new Date(list.createdAt), { addSuffix: true })
                  : '—'}
              </Td>
              <Td>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onEdit(list)}>
                      <Pencil className="h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => onArchive(list)}
                      className="text-[var(--st-text)]"
                    >
                      <Archive className="h-4 w-4" /> Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
