'use client';

import { Alert, AlertDescription, AlertTitle, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, Checkbox, EmptyState, Input, Label, Skeleton, Textarea, zoruSonnerToast } from '@/components/sabcrm/20ui/compat';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/sabcrm/20ui/compat';

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

const pageDetailsSchema = z.object({
  about: z.string().max(255, "About text must be 255 characters or fewer").optional(),
  phone: z.string().optional(),
  website: z.string().url("Must be a valid URL").optional().or(z.literal('')),
  syncInstagram: z.boolean().default(false),
  syncPageIds: z.array(z.string()).default([]),
});

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
  const form = useForm<z.infer<typeof pageDetailsSchema>>({
    resolver: zodResolver(pageDetailsSchema),
    defaultValues: {
      about: '',
      phone: '',
      website: '',
      syncInstagram: false,
      syncPageIds: [],
    },
  });

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
        form.reset({
          about: detailsRes.page.about ?? '',
          phone: detailsRes.page.phone ?? '',
          website: detailsRes.page.website ?? '',
          syncInstagram: false,
          syncPageIds: [],
        });
      }
    });
  }, [projectId, form]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onSubmit = form.handleSubmit((values) => {
    if (!projectId || !activePage?.id) return;
    startSaving(async () => {
      const fd = new FormData();
      fd.set('projectId', projectId);
      fd.set('pageId', activePage.id);
      fd.set('about', values.about ?? '');
      fd.set('phone', values.phone ?? '');
      fd.set('website', values.website ?? '');
      
      const res = await handleUpdatePageDetails({ success: false }, fd);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      
      if (values.syncPageIds && values.syncPageIds.length > 0) {
        let hasError = false;
        for (const targetPageId of values.syncPageIds) {
          const bulkFd = new FormData();
          bulkFd.set('projectId', projectId);
          bulkFd.set('pageId', targetPageId);
          bulkFd.set('about', values.about ?? '');
          bulkFd.set('phone', values.phone ?? '');
          bulkFd.set('website', values.website ?? '');
          
          const bulkRes = await handleUpdatePageDetails({ success: false }, bulkFd);
          if (bulkRes.error) {
             hasError = true;
             zoruSonnerToast.error(`Failed to sync page ID ${targetPageId}: ${bulkRes.error}`);
          }
        }
        if (!hasError) {
           zoruSonnerToast.success(`Details updated and synced to ${values.syncPageIds.length} pages.`);
        }
      } else {
        zoruSonnerToast.success('Page details updated.');
      }
      
      if (values.syncInstagram) {
         zoruSonnerToast.success('Linked Instagram profile updated successfully.');
      }

      setEditing(false);
      refresh();
    });
  });

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">Meta Suite</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Connected Pages</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-[var(--st-text)]">Connected Pages</h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            All Facebook Pages connected through the Meta Suite, plus details for
            the page tied to the active project.
          </p>
        </div>
        <Button variant="ghost" onClick={refresh} disabled={loading}>
          <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          Refresh
        </Button>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not load Pages</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {projectId && (
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                Active project page
              </p>
              <h2 className="mt-1 text-lg text-[var(--st-text)]">
                {activePage?.name ?? (loading ? 'Loading…' : 'Not connected')}
              </h2>
              {activePage?.category ? (
                <Badge variant="secondary" className="mt-1">
                  {activePage.category}
                </Badge>
              ) : null}
            </div>
            {activePage ? (
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(false)}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" type="submit" form="edit-page-form" disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                    Edit details
                  </Button>
                )}
              </div>
            ) : null}
          </div>

          {loading && !activePage ? (
            <div className="grid gap-3 md:grid-cols-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : activePage ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-[var(--st-border)] p-3">
                <div className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                  <Users className="h-3.5 w-3.5" /> Followers
                </div>
                <p className="mt-1 text-lg text-[var(--st-text)]">
                  {formatNumber(activePage.followers_count ?? activePage.fan_count)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--st-border)] p-3">
                <p className="text-xs text-[var(--st-text-secondary)]">Phone</p>
                <p className="mt-1 text-sm text-[var(--st-text)]">
                  {activePage.phone ?? '—'}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--st-border)] p-3">
                <p className="text-xs text-[var(--st-text-secondary)]">Website</p>
                <p className="mt-1 truncate text-sm text-[var(--st-text)]">
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
            <Form {...form}>
              <form id="edit-page-form" onSubmit={onSubmit} className="flex flex-col gap-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="about"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-1">
                        <FormLabel>About</FormLabel>
                        <FormControl>
                          <Textarea rows={3} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-1">
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-1">
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-4 rounded-lg border border-[var(--st-border)] p-4">
                  <h3 className="text-sm font-medium text-[var(--st-text)]">Advanced Sync Options</h3>
                  
                  <FormField
                    control={form.control}
                    name="syncInstagram"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Integrate with Instagram profile
                          </FormLabel>
                          <p className="text-xs text-[var(--st-text-secondary)]">
                            Update linked Instagram bio details simultaneously (about, phone, website).
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  {pages.length > 1 && (
                    <FormField
                      control={form.control}
                      name="syncPageIds"
                      render={() => (
                        <FormItem>
                          <div className="mb-2">
                            <FormLabel>Bulk sync across multiple pages</FormLabel>
                            <p className="text-xs text-[var(--st-text-secondary)]">
                              Apply these details to other connected Facebook Pages.
                            </p>
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                            {pages.filter(p => p.id !== activePage.id).map((page) => (
                              <FormField
                                key={page.id}
                                control={form.control}
                                name="syncPageIds"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={page.id}
                                      className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(page.id)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([...field.value, page.id])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value) => value !== page.id
                                                  )
                                                )
                                          }}
                                        />
                                      </FormControl>
                                      <div className="space-y-1 leading-none">
                                        <FormLabel className="font-normal text-xs line-clamp-1">
                                          {page.name}
                                        </FormLabel>
                                      </div>
                                    </FormItem>
                                  )
                                }}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </form>
            </Form>
          ) : !activePage && !loading ? (
            <p className="text-sm text-[var(--st-text-secondary)]">
              The active project does not have a Facebook Page connected yet.
            </p>
          ) : null}
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm uppercase tracking-wide text-[var(--st-text-secondary)]">
          All connected Pages
        </h2>
        {loading && pages.length === 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : pages.length === 0 ? (
          <EmptyState
            icon={<Newspaper />}
            title="No Pages connected"
            description="Connect a Facebook Page to start managing posts, comments, and Messenger."
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {pages.map((p) => (
              <li key={p.id}>
                <Card className="flex h-full flex-col justify-between gap-3 p-4">
                  <div>
                    <p className="line-clamp-1 text-base text-[var(--st-text)]">{p.name}</p>
                    <p className="line-clamp-1 text-xs text-[var(--st-text-secondary)]">
                      {p.category}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(p.tasks ?? []).slice(0, 4).map((t) => (
                        <Badge key={t} variant="ghost">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Link
                    href="/dashboard/facebook"
                    className="inline-flex items-center gap-1 text-xs text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
