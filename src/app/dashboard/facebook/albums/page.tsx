'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
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
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle,
  ChevronDown,
  Image as ImageIcon,
  RefreshCw } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getFacebookAlbumsAction,
  getFacebookAlbumPhotosAction,
  } from '@/app/actions/facebook-albums.actions';

/**
 * /dashboard/facebook/albums — Facebook Page photo albums.
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

  const [expanded, setExpanded] = useState<string | null>(null);
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

  const onExpand = (albumId: string) => {
    if (expanded === albumId) {
      setExpanded(null);
      return;
    }
    setExpanded(albumId);
    if (photosByAlbum[albumId]) return; // cached
    startPhotoLoading(async () => {
      const res = await getFacebookAlbumPhotosAction(projectId, albumId);
      if (res.error) return;
      setPhotosByAlbum((prev) => ({
        ...prev,
        [albumId]: (res.data as Photo[]) ?? [],
      }));
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState
          icon={<ImageIcon />}
          title="No project selected"
          description="Pick a Facebook page / project to see its albums."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">Dashboard</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">Meta Suite</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Albums</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-zoru-ink">Albums</h1>
          <p className="mt-1 text-sm text-zoru-ink-muted">
            Photo albums on the connected Facebook Page. Backed by{' '}
            <code>wachat-facebook-content</code>.
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
          <ZoruAlertTitle>Could not load albums</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </ZoruAlert>
      )}

      {loading && albums.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <ZoruSkeleton className="h-40 w-full" />
          <ZoruSkeleton className="h-40 w-full" />
          <ZoruSkeleton className="h-40 w-full" />
        </div>
      ) : albums.length === 0 ? (
        <ZoruEmptyState
          icon={<ImageIcon />}
          title="No albums"
          description="This Page doesn't have any photo albums yet."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {albums.map((a) => {
            const isOpen = expanded === a.id;
            const photos = photosByAlbum[a.id] ?? [];
            return (
              <li key={a.id}>
                <ZoruCard className="flex flex-col gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => onExpand(a.id)}
                    className="flex items-center gap-3 text-left"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zoru-surface-2">
                      {a.cover_photo?.source ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.cover_photo.source}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="flex-1">
                      <p className="line-clamp-1 text-base text-zoru-ink">
                        {a.name ?? '(untitled)'}
                      </p>
                      {a.description ? (
                        <p className="line-clamp-1 text-xs text-zoru-ink-muted">
                          {a.description}
                        </p>
                      ) : null}
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-zoru-ink-muted">
                        <ZoruBadge variant="ghost">{a.count ?? 0} photos</ZoruBadge>
                        {a.privacy ? <span>{a.privacy}</span> : null}
                        <span>{safeDate(a.updated_time ?? a.created_time)}</span>
                      </div>
                    </div>
                    <ChevronDown
                      className={
                        'h-4 w-4 transition ' + (isOpen ? 'rotate-180' : '')
                      }
                    />
                  </button>

                  {isOpen ? (
                    <div className="border-t border-zoru-line pt-3">
                      {photoLoading && photos.length === 0 ? (
                        <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
                          <ZoruSkeleton className="aspect-square w-full" />
                          <ZoruSkeleton className="aspect-square w-full" />
                          <ZoruSkeleton className="aspect-square w-full" />
                        </div>
                      ) : photos.length === 0 ? (
                        <p className="text-xs text-zoru-ink-muted">No photos.</p>
                      ) : (
                        <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
                          {photos.map((p) => (
                            <a
                              key={p.id}
                              href={p.source ?? p.picture ?? '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="aspect-square overflow-hidden rounded-md bg-zoru-surface-2"
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
                    </div>
                  ) : null}
                </ZoruCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
