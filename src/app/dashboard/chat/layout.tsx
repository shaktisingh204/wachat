
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List } from 'lucide-react';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col flex-1 h-full">
      <div className="flex-shrink-0 p-4 border-b flex items-center justify-between">
        <h1 className="text-3xl font-bold font-headline">Live Chat</h1>
        <div className="flex items-center gap-2">
            <Button asChild variant={pathname.endsWith('/kanban') ? 'default' : 'outline'} size="sm">
                <Link href="/dashboard/chat/kanban">
                    <LayoutGrid className="mr-2 h-4 w-4" />
                    Kanban
                </Link>
            </Button>
            <Button asChild variant={!pathname.endsWith('/kanban') ? 'default' : 'outline'} size="sm">
                <Link href="/dashboard/chat">
                    <List className="mr-2 h-4 w-4" />
                    List
                </Link>
            </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden h-full">
          {children}
      </div>
    </div>
  );
}
