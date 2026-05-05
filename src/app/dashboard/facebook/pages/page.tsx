'use client';

/**
 * /dashboard/facebook/pages — Connected Pages list (ZoruUI).
 *
 * Read-only list of every Facebook Page the user has granted access to,
 * rendered as a grid of ZoruCard tiles. Same data source as the original
 * (getFacebookPages). No clay / wabasimplify visuals.
 */

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ExternalLink as ExternalLinkIcon,
  Newspaper,
  RefreshCw,
  Settings2,
} from 'lucide-react';

import { getFacebookPages } from '@/app/actions/facebook.actions';
import type { FacebookPage } from '@/lib/definitions';

import {
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
} from '@/components/zoruui';

import { ErrorState, NoProjectState } from '../_components/no-project-state';

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5 flex items-center justify-between">
        <ZoruSkeleton className="h-9 w-72" />
        <ZoruSkeleton className="h-9 w-32" />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-40" />
        ))}
      </div>
    </div>
  );
}

export default function AllFacebookPagesPage() {
  const router = useRouter();
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setProjectId(localStorage.getItem('activeProjectId'));
  }, []);

  const fetchPages = React.useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const { pages: fetchedPages, error: fetchError } = await getFacebookPages();
      if (fetchError) {
        setError(fetchError);
      } else if (fetchedPages) {
        setError(null);
        setPages(fetchedPages);
      }
    });
  }, [projectId]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  if (isLoading && pages.length === 0) {
    return <PageSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      {/* Breadcrumb */}
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Connected Pages</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      {/* Page header */}
      <ZoruPageHeader className="mt-4">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Meta Suite · Account</ZoruPageEyebrow>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-2.5">
              <Newspaper className="h-6 w-6 text-zoru-ink-muted" />
              Connected Pages
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Every Facebook Page you have granted access to, scoped to the
            currently active project.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={fetchPages}
            disabled={isLoading}
          >
            <RefreshCw className={isLoading ? 'animate-spin' : ''} /> Refresh
          </ZoruButton>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/facebook/setup')}
          >
            <Settings2 /> Setup
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {/* Body */}
      <div className="mt-6">
        {isClient && !projectId ? (
          <NoProjectState />
        ) : error ? (
          <ErrorState message={error} />
        ) : pages.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((page) => (
              <ZoruCard key={page.id} className="flex flex-col gap-4 p-5">
                <div className="flex items-start gap-3">
                  <ZoruAvatar className="h-11 w-11">
                    <ZoruAvatarImage
                      src={`https://graph.facebook.com/${page.id}/picture?type=square`}
                      alt={page.name}
                    />
                    <ZoruAvatarFallback>
                      {page.name?.charAt(0)?.toUpperCase() ?? 'F'}
                    </ZoruAvatarFallback>
                  </ZoruAvatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-zoru-ink leading-tight">
                      {page.name}
                    </p>
                    {page.category && (
                      <p className="mt-0.5 truncate text-[12px] text-zoru-ink-muted leading-tight">
                        {page.category}
                      </p>
                    )}
                  </div>
                  <ZoruBadge variant="outline">Connected</ZoruBadge>
                </div>

                <div className="flex items-center gap-2">
                  <ZoruButton variant="outline" size="sm" className="flex-1" asChild>
                    <Link
                      href={`https://facebook.com/${page.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLinkIcon /> View Page
                    </Link>
                  </ZoruButton>
                  <ZoruButton
                    size="sm"
                    className="flex-1"
                    onClick={() => router.push('/dashboard/facebook/settings')}
                  >
                    Manage
                  </ZoruButton>
                </div>
              </ZoruCard>
            ))}
          </div>
        ) : (
          <ZoruEmptyState
            icon={<Newspaper />}
            title="No Pages found"
            description="No Facebook Pages were returned for the connected account. Run setup to grant access to one or more Pages."
            action={
              <ZoruButton
                size="sm"
                onClick={() => router.push('/dashboard/facebook/setup')}
              >
                <Settings2 /> Run setup
              </ZoruButton>
            }
          />
        )}
      </div>
    </div>
  );
}
