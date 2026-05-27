'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Archive, MoreHorizontal, Pencil, Users } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  EmptyState,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
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
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead>Name</ZoruTableHead>
            <ZoruTableHead>Subscribers</ZoruTableHead>
            <ZoruTableHead>Default sender</ZoruTableHead>
            <ZoruTableHead>Created</ZoruTableHead>
            <ZoruTableHead className="w-[60px]" />
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {lists.map((list) => (
            <ZoruTableRow key={list._id}>
              <ZoruTableCell>
                <Link
                  href={`/dashboard/email/audience/lists/${list._id}`}
                  className="font-medium text-zoru-ink hover:underline"
                >
                  {list.name}
                </Link>
                {list.description ? (
                  <p className="text-xs text-zoru-ink-muted truncate max-w-md">
                    {list.description}
                  </p>
                ) : null}
              </ZoruTableCell>
              <ZoruTableCell>
                <Badge variant="outline">{list.subscriberCount ?? 0}</Badge>
              </ZoruTableCell>
              <ZoruTableCell className="text-zoru-ink-muted text-sm">
                {list.defaultFromEmail ?? '—'}
              </ZoruTableCell>
              <ZoruTableCell className="text-zoru-ink-muted text-sm">
                {list.createdAt
                  ? formatDistanceToNow(new Date(list.createdAt), { addSuffix: true })
                  : '—'}
              </ZoruTableCell>
              <ZoruTableCell>
                <DropdownMenu>
                  <ZoruDropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </ZoruDropdownMenuTrigger>
                  <ZoruDropdownMenuContent align="end">
                    <ZoruDropdownMenuItem onSelect={() => onEdit(list)}>
                      <Pencil className="h-4 w-4" /> Edit
                    </ZoruDropdownMenuItem>
                    <ZoruDropdownMenuItem
                      onSelect={() => onArchive(list)}
                      className="text-zoru-ink"
                    >
                      <Archive className="h-4 w-4" /> Archive
                    </ZoruDropdownMenuItem>
                  </ZoruDropdownMenuContent>
                </DropdownMenu>
              </ZoruTableCell>
            </ZoruTableRow>
          ))}
        </ZoruTableBody>
      </Table>
    </Card>
  );
}
