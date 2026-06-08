'use client';

import {
  Alert,
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Skeleton,
  StatCard,
  toast,
} from '@/components/sabcrm/20ui';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Instagram,
  Link2,
  RefreshCw,
  Unplug,
} from 'lucide-react';

import { getProjects } from '@/app/actions/project.actions';
import { getInstagramAccountForPage } from '@/app/actions/instagram.actions';
import { useProject } from '@/context/project-context';
import type { Project, WithId } from '@/lib/definitions';

/**
 * /dashboard/instagram/setup — Instagram connection status per project.
 *
 * Lists every Facebook project owned by the caller and inspects whether
 * its Page has a linked Instagram Business account. Pages without a link
 * surface a "Connect" affordance that routes back to the canonical
 * Meta Suite onboarding wizard (`/dashboard/facebook/all-projects`),
 * which is the source of truth for OAuth and IG/FB pairing.
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

const tabular = { fontVariantNumeric: 'tabular-nums' } as const;

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

  const counts = useMemo(() => {
    const values = Object.values(rows);
    return {
      total: projects.length,
      connected: values.filter((r) => r.status === 'connected').length,
      missing: values.filter((r) => r.status === 'missing').length,
    };
  }, [rows, projects.length]);

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-6 pt-6 pb-10">
      <PageHeader>
        <PageHeaderHeading>
          <PageDescription>Instagram</PageDescription>
          <PageTitle>
            <span className="inline-flex items-center gap-3">
              <Link2 className="h-6 w-6 text-[var(--st-text-secondary)]" aria-hidden="true" />
              Setup
            </span>
          </PageTitle>
          <PageDescription>
            Each Facebook project below shows whether its Page has a linked Instagram Business account.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="ghost" iconLeft={RefreshCw} loading={loading} onClick={refresh}>
            Refresh
          </Button>
          <Button asChild>
            <Link href="/dashboard/facebook/all-projects">
              Open Meta Suite setup
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      {error ? (
        <Alert tone="danger" title="Could not load projects">
          {error}
        </Alert>
      ) : null}

      {projects.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Facebook projects"
            value={<span style={tabular}>{counts.total}</span>}
            icon={Instagram}
            accent="#d6249f"
          />
          <StatCard
            label="Instagram connected"
            value={<span style={tabular}>{counts.connected}</span>}
            icon={CheckCircle2}
            accent="#1f9d55"
          />
          <StatCard
            label="Not connected"
            value={<span style={tabular}>{counts.missing}</span>}
            icon={Unplug}
            accent="#d4760a"
          />
        </div>
      ) : null}

      {loading && projects.length === 0 ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : projects.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            icon={Instagram}
            title="No Facebook projects"
            description="Connect a Facebook Page first — your Instagram Business account links through the Page."
            action={
              <Button asChild>
                <Link href="/dashboard/facebook/all-projects">
                  Open Meta Suite setup
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((p) => {
            const id = p._id.toString();
            const row = rows[id] ?? { status: 'loading' as IgStatus };
            const isActive = id === activeId;
            const connected = row.status === 'connected';
            return (
              <li key={id}>
                <Card className="flex items-center gap-3" padding="md">
                  <Avatar
                    name={row.igUsername || p.name}
                    src={row.igPicture}
                    shape="round"
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-[var(--st-text)]">{p.name}</p>
                      {isActive ? <Badge tone="accent">Active</Badge> : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[var(--st-text-secondary)]">
                      Page ID: {p.facebookPageId || '—'}
                      {row.igUsername ? <> · @{row.igUsername}</> : null}
                    </p>
                    <div className="mt-1.5">
                      {row.status === 'loading' ? (
                        <Skeleton className="h-4 w-36" />
                      ) : connected ? (
                        <Badge tone="success" dot>
                          Instagram connected
                        </Badge>
                      ) : (
                        <Badge tone="warning" dot>
                          Not connected
                        </Badge>
                      )}
                    </div>
                  </div>

                  {connected ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href="/dashboard/instagram">
                        Open
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      size="sm"
                      onClick={() => toast.info('Opening Meta Suite onboarding')}
                    >
                      <Link href="/dashboard/facebook/all-projects">
                        Connect
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </Button>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Card variant="outlined" padding="none">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
            Where do I connect Instagram?
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <Callout tone="info">
            Instagram Business accounts link to a Facebook Page in Meta Business Suite. Once linked
            there, this page detects the connection and unlocks the Instagram modules.
          </Callout>
          <div>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/facebook/all-projects">
                Open Meta Suite onboarding
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
