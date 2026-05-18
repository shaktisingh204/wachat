'use client';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
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
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  ZoruTextarea,
  zoruSonnerToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ExternalLink,
  Newspaper,
  RefreshCw,
  Users,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getFacebookPages,
  getPageDetails,
  handleUpdatePageDetails,
  } from '@/app/actions/facebook.actions';
import type { FacebookPage,
  FacebookPageDetails } from '@/lib/definitions';

/**
 * /dashboard/facebook/pages — Connected Facebook Pages.
 *
 * Lists every Facebook Page the current user has connected via
 * `getFacebookPages` and highlights the active project's page details
 * (about / phone / website) via `getPageDetails`. Page details can be
 * edited inline and persisted with `handleUpdatePageDetails`.
 */

import * as React from 'react';

function formatNumber(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat().format(n);
}

export default function FacebookConnectedPagesPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [activePage, setActivePage] = useState<FacebookPageDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ about: string; phone: string; website: string }>(
    { about: '', phone: '', website: '' },
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [pagesRes, detailsRes] = await Promise.all([
        getFacebookPages(),
        projectId ? getPageDetails(projectId) : Promise.resolve({ page: undefined, error: undefined }),
      ]);
      if (pagesRes.error) {
        setError(pagesRes.error);
      } else {
        setError(null);
      }
      setPages(pagesRes.pages ?? []);
      setActivePage((detailsRes.page as FacebookPageDetails | undefined) ?? null);
      if (detailsRes.page) {
        setForm({
          about: detailsRes.page.about ?? '',
          phone: detailsRes.page.phone ?? '',
          website: detailsRes.page.website ?? '',
        });
      }
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onSave = () => {
    if (!projectId || !activePage?.id) return;
    startSaving(async () => {
      const fd = new FormData();
      fd.set('projectId', projectId);
      fd.set('pageId', activePage.id);
      fd.set('about', form.about);
      fd.set('phone', form.phone);
      fd.set('website', form.website);
      const res = await handleUpdatePageDetails({ success: false }, fd);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      zoruSonnerToast.success('Page details updated.');
      setEditing(false);
      refresh();
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">Meta Suite</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Connected Pages</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-zoru-ink">Connected Pages</h1>
          <p className="mt-1 text-sm text-zoru-ink-muted">
            All Facebook Pages connected through the Meta Suite, plus details for
            the page tied to the active project.
          </p>
        </div>
        <ZoruButton variant="ghost" onClick={refresh} disabled={loading}>
          <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          Refresh
        </ZoruButton>
      </header>

      {error && (
        <ZoruAlert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Could not load Pages</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </ZoruAlert>
      )}

      {projectId && (
        <ZoruCard className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-zoru-ink-muted">
                Active project page
              </p>
              <h2 className="mt-1 text-lg text-zoru-ink">
                {activePage?.name ?? (loading ? 'Loading…' : 'Not connected')}
              </h2>
              {activePage?.category ? (
                <ZoruBadge variant="secondary" className="mt-1">
                  {activePage.category}
                </ZoruBadge>
              ) : null}
            </div>
            {activePage ? (
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <ZoruButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(false)}
                      disabled={saving}
                    >
                      Cancel
                    </ZoruButton>
                    <ZoruButton size="sm" onClick={onSave} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </ZoruButton>
                  </>
                ) : (
                  <ZoruButton variant="ghost" size="sm" onClick={() => setEditing(true)}>
                    Edit details
                  </ZoruButton>
                )}
              </div>
            ) : null}
          </div>

          {loading && !activePage ? (
            <div className="grid gap-3 md:grid-cols-3">
              <ZoruSkeleton className="h-20 w-full" />
              <ZoruSkeleton className="h-20 w-full" />
              <ZoruSkeleton className="h-20 w-full" />
            </div>
          ) : activePage ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-zoru-line p-3">
                <div className="flex items-center gap-2 text-xs text-zoru-ink-muted">
                  <Users className="h-3.5 w-3.5" /> Followers
                </div>
                <p className="mt-1 text-lg text-zoru-ink">
                  {formatNumber(activePage.followers_count ?? activePage.fan_count)}
                </p>
              </div>
              <div className="rounded-lg border border-zoru-line p-3">
                <p className="text-xs text-zoru-ink-muted">Phone</p>
                <p className="mt-1 text-sm text-zoru-ink">
                  {activePage.phone ?? '—'}
                </p>
              </div>
              <div className="rounded-lg border border-zoru-line p-3">
                <p className="text-xs text-zoru-ink-muted">Website</p>
                <p className="mt-1 truncate text-sm text-zoru-ink">
                  {activePage.website ? (
                    <a
                      href={activePage.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {activePage.website}
                    </a>
                  ) : (
                    '—'
                  )}
                </p>
              </div>
            </div>
          ) : null}

          {editing && activePage ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <ZoruLabel htmlFor="about">About</ZoruLabel>
                <ZoruTextarea
                  id="about"
                  rows={3}
                  value={form.about}
                  onChange={(e) => setForm((p) => ({ ...p, about: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <ZoruLabel htmlFor="phone">Phone</ZoruLabel>
                <ZoruInput
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <ZoruLabel htmlFor="website">Website</ZoruLabel>
                <ZoruInput
                  id="website"
                  value={form.website}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, website: e.target.value }))
                  }
                />
              </div>
            </div>
          ) : !activePage && !loading ? (
            <p className="text-sm text-zoru-ink-muted">
              The active project does not have a Facebook Page connected yet.
            </p>
          ) : null}
        </ZoruCard>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm uppercase tracking-wide text-zoru-ink-muted">
          All connected Pages
        </h2>
        {loading && pages.length === 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <ZoruSkeleton className="h-28 w-full" />
            <ZoruSkeleton className="h-28 w-full" />
            <ZoruSkeleton className="h-28 w-full" />
          </div>
        ) : pages.length === 0 ? (
          <ZoruEmptyState
            icon={<Newspaper />}
            title="No Pages connected"
            description="Connect a Facebook Page to start managing posts, comments, and Messenger."
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {pages.map((p) => (
              <li key={p.id}>
                <ZoruCard className="flex h-full flex-col justify-between gap-3 p-4">
                  <div>
                    <p className="line-clamp-1 text-base text-zoru-ink">{p.name}</p>
                    <p className="line-clamp-1 text-xs text-zoru-ink-muted">
                      {p.category}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(p.tasks ?? []).slice(0, 4).map((t) => (
                        <ZoruBadge key={t} variant="ghost">
                          {t}
                        </ZoruBadge>
                      ))}
                    </div>
                  </div>
                  <Link
                    href="/dashboard/facebook"
                    className="inline-flex items-center gap-1 text-xs text-zoru-ink-muted hover:text-zoru-ink"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </Link>
                </ZoruCard>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
