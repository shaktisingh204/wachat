'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Pencil, Search, Filter, MoreHorizontal, Copy, Trash, Archive, BarChart } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  IconButton,
  Input,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/sabcrm/20ui';

import type { SabcheckoutPageDoc } from '@/lib/rust-client/sabcheckout-pages';

export interface SabcheckoutPagesListClientProps {
  items: SabcheckoutPageDoc[];
  page: number;
  hasMore: boolean;
}

export function SabcheckoutPagesListClient({
  items,
}: SabcheckoutPagesListClientProps) {
  const [search, setSearch] = useState('');

  const filteredItems = items.filter(p =>
    p.displayName.toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card padding="none" className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
        <div className="flex items-center gap-2">
          <Field label="Search pages" className="w-64 [&_.u-field__label]:sr-only">
            <Input
              type="search"
              placeholder="Search pages..."
              iconLeft={Search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" iconLeft={Filter}>
            Filter
          </Button>
        </div>
      </div>

      <CardBody className="p-0">
        {filteredItems.length === 0 ? (
          <div className="px-6 py-12">
            <EmptyState
              icon={Search}
              title="No pages found"
              description={search ? `Nothing matches "${search}".` : 'Create your first checkout page to get started.'}
            />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--st-border)]">
            {filteredItems.map((p) => (
              <li
                key={p._id}
                className="group flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-[var(--st-hover)]/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="truncate text-[15px] font-medium text-[var(--st-text)]">
                      {p.displayName}
                    </span>
                    <Badge tone={p.status === 'live' ? 'success' : 'neutral'}>
                      {p.status}
                    </Badge>
                    <Badge tone="neutral" kind="outline" className="capitalize">
                      {p.mode}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-[13px] text-[var(--st-text-tertiary)]">
                    <span className="flex items-center gap-1 font-mono text-xs">
                      /pay/{p.slug}
                    </span>
                    <span className="flex items-center gap-1">
                      Currency: <span className="font-medium uppercase text-[var(--st-text-secondary)]">{p.currency}</span>
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                  <Link
                    href={`/pay/${encodeURIComponent(p.slug)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <IconButton label="Open live page" icon={ExternalLink} variant="ghost" size="sm" />
                  </Link>
                  <Link href={`/dashboard/sabcheckout/${p._id}`}>
                    <Button variant="outline" size="sm" iconLeft={Pencil}>
                      Edit
                    </Button>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton label="Open menu" icon={MoreHorizontal} variant="ghost" size="sm" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[160px]">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem iconLeft={Copy}>Copy Link</DropdownMenuItem>
                      <DropdownMenuItem iconLeft={BarChart}>View Analytics</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem iconLeft={Archive}>Archive Page</DropdownMenuItem>
                      <DropdownMenuItem variant="danger" iconLeft={Trash}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
