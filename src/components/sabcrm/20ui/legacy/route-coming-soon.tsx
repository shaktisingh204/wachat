'use client';

import * as React from 'react';
import Link from 'next/link';
import { Construction } from 'lucide-react';

import { Button } from './button';
import { EmptyState } from './empty-state';

export interface RouteComingSoonProps {
  title: string;
  description?: string;
  parentHref?: string;
  parentLabel?: string;
}

export function RouteComingSoon({
  title,
  description = 'This page is on the roadmap and not yet available. The route is reserved so links and bookmarks keep working — check back once the feature ships.',
  parentHref = '/dashboard',
  parentLabel = 'Back to dashboard',
}: RouteComingSoonProps): React.JSX.Element {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8">
      <EmptyState
        icon={<Construction />}
        title={title}
        description={description}
        action={
          <Button asChild variant="ghost">
            <Link href={parentHref}>{parentLabel}</Link>
          </Button>
        }
      />
    </div>
  );
}
