'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  EmptyState,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageActions,
  Skeleton,
} from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle,
  Image as ImageIcon,
  RefreshCw } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getFacebookAlbumsAction,
  getFacebookAlbumPhotosAction,
  } from '@/app/actions/facebook-albums.actions';

/**
 * /dashboard/facebook/albums - Facebook Page photo albums.
 *
 * Lists albums for the active project's connected Page via the
 * `wachat-facebook-content` Rust crate. Click an album to expand its
 * photos inline.
 */

import * as React from 'react';

interface Album {
  id: string;
  name?: string;
  description?: string;
  count?: number;
  cover_photo?: { id?: string; source?: string };
  created_time?: string;
  updated_time?: string;
  privacy?: string;
}

interface Photo {
  id: string;
  source?: string;
  picture?: string;
  name?: string;
  created_time?: string;
}

function safeDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

export default function FacebookAlbumsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [albums, setAlbums] = useState<Album[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const [expanded, setExpanded] = useState<string>('');
  const [photosByAlbum, setPhotosByAlbum] = useState<Record<string, Photo[]>>({});
  const [photoLoading, startPhotoLoading] = useTransition();

  const refresh = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const res = await getFacebookAlbumsAction(projectId);
      if (res.error) {
        setError(res.error);
        setAlbums([]);
        return;
      }
      setError(null);
      setAlbums((res.data as Album[]) ?? []);
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadPhotos = useCallback(
    (albumId: string) => {
      if (photosByAlbum[albumId]) return; // cached
      startPhotoLoading(async () => {
        const res = await getFacebookAlbumPhotosAction(projectId, albumId);
        if (res.error) return;
        setPhotosByAlbum((prev) => ({
          ...prev,
          [albumId]: (res.data as Photo[]) ?? [],
        }));
      });
    },
    [photosByAlbum, projectId],
  );

  const onValueChange = (albumId: string) => {
    setExpanded(albumId);
    if (albumId) loadPhotos(albumId);
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={ImageIcon}
          title="No project selected"
          description="Pick a Facebook page / project to see its albums."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">Meta Suite</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Albums</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Albums</PageTitle>
          <PageDescription>
            Photo albums on the connected Facebook Page. Backed by{' '}
            <code>wachat-facebook-content</code>.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="ghost"
            onClick={refresh}
            loading={loading}
            iconLeft={RefreshCw}
          >
            Refresh
          </Button>
        </PageActions>
      </PageHeader>

      {error && (
        <Alert tone="danger" icon={AlertCircle}>
          <AlertTitle>Could not load albums</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && albums.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : albums.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No albums"
          description="This Page does not have any photo albums yet."
        />
      ) : (
        <Accordion
          type="single"
          collapsible
          value={expanded}
          onValueChange={onValueChange}
        >
          {albums.map((a) => {
            const photos = photosByAlbum[a.id] ?? [];
            return (
              <AccordionItem key={a.id} value={a.id}>
                <AccordionTrigger>
                  <span className="flex items-center gap-3">
                    <span className="h-16 w-16 shrink-0 overflow-hidden rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]">
                      {a.cover_photo?.source ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.cover_photo.source}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block line-clamp-1 text-base text-[var(--st-text)]">
                        {a.name ?? '(untitled)'}
                      </span>
                      {a.description ? (
                        <span className="block line-clamp-1 text-xs text-[var(--st-text-secondary)]">
                          {a.description}
                        </span>
                      ) : null}
                      <span className="mt-1 flex items-center gap-2 text-[11px] text-[var(--st-text-secondary)]">
                        <Badge tone="neutral">{a.count ?? 0} photos</Badge>
                        {a.privacy ? <span>{a.privacy}</span> : null}
                        <span>{safeDate(a.updated_time ?? a.created_time)}</span>
                      </span>
                    </span>
                  </span>
                </AccordionTrigger>

                <AccordionContent>
                  {photoLoading && photos.length === 0 ? (
                    <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
                      <Skeleton className="aspect-square w-full" />
                      <Skeleton className="aspect-square w-full" />
                      <Skeleton className="aspect-square w-full" />
                    </div>
                  ) : photos.length === 0 ? (
                    <p className="text-xs text-[var(--st-text-secondary)]">No photos.</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
                      {photos.map((p) => (
                        <a
                          key={p.id}
                          href={p.source ?? p.picture ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="aspect-square overflow-hidden rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]"
                        >
                          {p.source || p.picture ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.picture ?? p.source}
                              alt={p.name ?? ''}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </a>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
