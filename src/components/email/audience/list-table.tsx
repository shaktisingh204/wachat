'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Archive, MoreHorizontal, Pencil, Users } from 'lucide-react';
import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruEmptyState,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import type { EmailListDoc } from '@/app/actions/email/audience.actions';

interface EmailListTableProps {
  lists: EmailListDoc[];
  onEdit: (list: EmailListDoc) => void;
  onArchive: (list: EmailListDoc) => void;
}

export function EmailListTable({ lists, onEdit, onArchive }: EmailListTableProps) {
  if (lists.length === 0) {
    return (
      <ZoruEmptyState
        icon={<Users />}
        title="No lists yet"
        description="Create your first audience list to start collecting subscribers."
      />
    );
  }

  return (
    <ZoruCard className="p-0 overflow-hidden">
      <ZoruTable>
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
                <ZoruBadge variant="outline">{list.subscriberCount ?? 0}</ZoruBadge>
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
                <ZoruDropdownMenu>
                  <ZoruDropdownMenuTrigger asChild>
                    <ZoruButton variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </ZoruButton>
                  </ZoruDropdownMenuTrigger>
                  <ZoruDropdownMenuContent align="end">
                    <ZoruDropdownMenuItem onSelect={() => onEdit(list)}>
                      <Pencil className="h-4 w-4" /> Edit
                    </ZoruDropdownMenuItem>
                    <ZoruDropdownMenuItem
                      onSelect={() => onArchive(list)}
                      className="text-destructive"
                    >
                      <Archive className="h-4 w-4" /> Archive
                    </ZoruDropdownMenuItem>
                  </ZoruDropdownMenuContent>
                </ZoruDropdownMenu>
              </ZoruTableCell>
            </ZoruTableRow>
          ))}
        </ZoruTableBody>
      </ZoruTable>
    </ZoruCard>
  );
}
