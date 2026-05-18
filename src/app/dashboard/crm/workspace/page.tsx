import { ZoruCard, ZoruPageDescription, ZoruPageHeader, ZoruPageHeading, ZoruPageTitle } from '@/components/zoruui';
import {
  ArrowUpRight,
  Award,
  BookOpen,
  CalendarDays,
  MessageSquare,
  Megaphone,
  Bell,
  StickyNote,
  } from 'lucide-react';

/**
 * Workspace module overview — tile grid linking every sub-feature.
 *
 * Was a `redirect('/dashboard/crm')` shim.
 */

import Link from 'next/link';

interface NavTile {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tiles: NavTile[] = [
  { href: '/dashboard/crm/workspace/announcements', title: 'Announcements', description: 'Company-wide announcements pinned to the workspace.', icon: Megaphone },
  { href: '/dashboard/crm/workspace/notices', title: 'Notices', description: 'Time-sensitive notices and reminders.', icon: Bell },
  { href: '/dashboard/crm/workspace/awards', title: 'Awards', description: 'Recognise teammates with badges and awards.', icon: Award },
  { href: '/dashboard/crm/workspace/events', title: 'Events', description: 'Upcoming workspace events and meetings.', icon: CalendarDays },
  { href: '/dashboard/crm/workspace/discussions', title: 'Discussions', description: 'Long-form threaded discussions.', icon: MessageSquare },
  { href: '/dashboard/crm/workspace/sticky-notes', title: 'Sticky Notes', description: 'Personal and shared notes on the workspace board.', icon: StickyNote },
  { href: '/dashboard/crm/workspace/knowledge-base', title: 'Knowledge Base', description: 'Internal documentation and runbooks.', icon: BookOpen },
];

export default function CrmWorkspaceHubPage() {
  return (
    <div className="flex min-h-full flex-col gap-6 p-4 sm:p-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Workspace</ZoruPageTitle>
          <ZoruPageDescription>
            The team hub — announcements, notices, recognition, and discussions.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.href} href={tile.href} className="group">
              <ZoruCard className="h-full p-5 transition-shadow group-hover:shadow-[var(--zoru-shadow-md)]">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-medium text-zoru-ink">{tile.title}</p>
                  <ArrowUpRight className="h-4 w-4 text-zoru-ink-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zoru-ink" />
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-zoru-ink-muted">
                  {tile.description}
                </p>
              </ZoruCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
