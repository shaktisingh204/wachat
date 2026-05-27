'use client';

/**
 * Client-side table renderer for SabCheckout pages list. Server
 * fetches; this just lays out rows + share/edit links.
 */

import Link from 'next/link';
import { ExternalLink, Pencil } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
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
  return (
    <Card>
      <ZoruCardContent className="p-0">
        <ul className="divide-y divide-[var(--zoru-border)]">
          {items.map((p) => (
            <li
              key={p._id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {p.displayName}
                  </span>
                  <Badge variant={p.status === 'live' ? 'default' : 'secondary'}>
                    {p.status}
                  </Badge>
                  <Badge variant="outline">{p.mode}</Badge>
                </div>
                <p className="truncate text-xs text-[var(--zoru-muted-fg)]">
                  /pay/{p.slug} · {p.currency}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/pay/${encodeURIComponent(p.slug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="ghost" size="sm" aria-label="Open public page">
                    <ExternalLink className="size-4" />
                  </Button>
                </Link>
                <Link href={`/dashboard/sabcheckout/${p._id}`}>
                  <Button variant="outline" size="sm">
                    <Pencil className="mr-1 size-4" />
                    Edit
                  </Button>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </ZoruCardContent>
    </Card>
  );
}
