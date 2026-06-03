'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Pencil, Search, Filter, MoreHorizontal, Copy, Trash, Archive, BarChart } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  Input,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/zoruui';

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
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-zoru-line bg-zoru-surface p-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
            <Input
              type="search"
              placeholder="Search pages..."
              className="w-64 pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
        </div>
      </div>
      
      <ZoruCardContent className="p-0">
        <ul className="divide-y divide-zoru-line">
          {filteredItems.map((p) => (
            <li
              key={p._id}
              className="group flex items-center justify-between gap-4 px-6 py-4 hover:bg-zoru-surface-hover/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className="truncate text-[15px] font-medium text-zoru-ink">
                    {p.displayName}
                  </span>
                  <Badge variant={p.status === 'live' ? 'default' : 'secondary'} className="text-[11px] h-5">
                    {p.status}
                  </Badge>
                  <Badge variant="outline" className="text-[11px] h-5 capitalize bg-zoru-bg">{p.mode}</Badge>
                </div>
                <div className="mt-1 flex items-center gap-4 text-[13px] text-zoru-ink-subtle">
                  <span className="flex items-center gap-1 font-mono text-xs">
                    /pay/{p.slug}
                  </span>
                  <span className="flex items-center gap-1">
                    Currency: <span className="uppercase font-medium text-zoru-ink-muted">{p.currency}</span>
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <Link
                  href={`/pay/${encodeURIComponent(p.slug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-zoru-ink-subtle hover:text-zoru-ink">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href={`/dashboard/sabcheckout/${p._id}`}>
                  <Button variant="outline" size="sm" className="h-8">
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[160px]">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Link
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <BarChart className="mr-2 h-4 w-4" />
                      View Analytics
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive Page
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-zoru-danger focus:text-zoru-danger">
                      <Trash className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
          {filteredItems.length === 0 && (
            <li className="px-6 py-12 text-center text-sm text-zoru-ink-muted">
              No pages found matching "{search}".
            </li>
          )}
        </ul>
      </ZoruCardContent>
    </Card>
  );
}
