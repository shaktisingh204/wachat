'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
  Skeleton,
  zoruSonnerToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Instagram,
  RefreshCw,
  } from 'lucide-react';

import { getProjects } from '@/app/actions/project.actions';
import { getInstagramAccountForPage } from '@/app/actions/instagram.actions';
import { useProject } from '@/context/project-context';
import type { Project,
  WithId } from '@/lib/definitions';

/**
 * /dashboard/instagram/setup — Instagram connection status per project.
 *
 * Lists every Facebook project owned by the caller and inspects whether
 * its Page has a linked Instagram Business account. Pages without a link
 * surface a "Connect" affordance that routes back to the canonical
 * Meta Suite onboarding wizard (`/dashboard/facebook/all-projects`),
 * which is the source of truth for OAuth and IG/FB pairing.
 *
 * Pure client surface: data is loaded via two server actions
 * (`getProjects` and `getInstagramAccountForPage`) — no axios in the page.
 */

import * as React from 'react';

type IgStatus = 'loading' | 'connected' | 'missing' | 'error';

interface IgRowState {
  status: IgStatus;
  igId?: string;
  igUsername?: string;
  igPicture?: string;
  error?: string;
}

export default function InstagramSetupPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const activeId = activeProject?._id?.toString() ?? '';

  const [projects, setProjects] = useState<WithId<Project>[]>([]);
  const [rows, setRows] = useState<Record<string, IgRowState>>({});
  const [loading, startLoading] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    startLoading(async () => {
      try {
        const result = await getProjects(undefined, 'facebook');
        const list = Array.isArray(result)
          ? result
          : result && Array.isArray((result as any).projects)
            ? ((result as any).projects as WithId<Project>[])
            : [];
        setProjects(list);
        setError(null);

        // Hydrate each project's IG status in parallel — best-effort.
        const initial: Record<string, IgRowState> = {};
        for (const p of list) initial[p._id.toString()] = { status: 'loading' };
        setRows(initial);

        await Promise.all(
          list.map(async (p) => {
            const id = p._id.toString();
            const res = await getInstagramAccountForPage(id);
            setRows((prev) => ({
              ...prev,
              [id]: res.error
                ? { status: res.instagramAccount ? 'connected' : 'missing', error: res.error }
                : res.instagramAccount
                  ? {
                      status: 'connected',
                      igId: res.instagramAccount.id,
                      igUsername: res.instagramAccount.username,
                      igPicture: res.instagramAccount.profile_picture_url,
                    }
                  : { status: 'missing' },
            }));
          }),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load projects.');
      }
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onConnectClick = () => {
    zoruSonnerToast.info('Opening Meta Suite onboarding…');
  };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/instagram">Instagram</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Setup</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-[var(--st-text)]">Instagram setup</h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            Connect Instagram Business accounts to your Facebook Pages. Each project
            below shows its current connection status.
          </p>
        </div>
        <Button variant="ghost" onClick={refresh} disabled={loading}>
          <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          Refresh
        </Button>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Could not load projects</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      ) : null}

      {loading && projects.length === 0 ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<Instagram />}
          title="No Facebook projects"
          description="Connect a Facebook Page first — your Instagram Business account links through the Page."
          action={
            <Button asChild>
              <Link href="/dashboard/facebook/all-projects">
                Open Meta Suite setup <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((p) => {
            const id = p._id.toString();
            const row = rows[id] ?? { status: 'loading' as IgStatus };
            const isActive = id === activeId;
            return (
              <li key={id}>
                <Card className="flex items-center gap-3 p-4">
                  <Avatar className="h-12 w-12">
                    {row.igPicture ? (
                      <ZoruAvatarImage src={row.igPicture} alt="" />
                    ) : null}
                    <ZoruAvatarFallback>
                      <Instagram className="h-5 w-5" />
                    </ZoruAvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm text-[var(--st-text)]">{p.name}</p>
                      {isActive ? (
                        <Badge variant="outline">Active</Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[var(--st-text-secondary)]">
                      Page ID: {p.facebookPageId || '—'}
                      {row.igUsername ? <> · @{row.igUsername}</> : null}
                    </p>
                    {row.status === 'loading' ? (
                      <Skeleton className="mt-2 h-3 w-32" />
                    ) : row.status === 'connected' ? (
                      <Badge variant="success" className="mt-2 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Instagram connected
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="mt-2 gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Not connected
                      </Badge>
                    )}
                  </div>

                  {row.status === 'connected' ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href="/dashboard/instagram">
                        Open <ExternalLink className="h-3 w-3" />
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild size="sm" onClick={onConnectClick}>
                      <Link href="/dashboard/facebook/all-projects">
                        Connect <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Card className="mt-2 p-4">
        <p className="text-sm text-[var(--st-text)]">Where do I connect Instagram?</p>
        <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
          Instagram Business accounts must be linked to a Facebook Page in Meta
          Business Suite. Once linked there, this page will detect the connection
          and unlock the Instagram modules.
        </p>
        <div className="mt-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/facebook/all-projects">
              Open Meta Suite onboarding <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
