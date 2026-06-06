'use client';

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger, EmptyState, ZoruFilesPage, PageActions, PageDescription, PageEyebrow, PageHeader, PageHeading, PageTitle, Skeleton, useToast, type ZoruFileEntity } from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import { ChevronDown,
  FolderOpen,
  Image as ImageIcon,
  ListVideo,
  Video } from 'lucide-react';

import {
  getPageAlbums,
  getPagePhotos,
  getPageVideos,
  getVideoPlaylists,
  } from '@/app/actions/facebook.actions';

/**
 * /dashboard/facebook/media — Page media library (ZoruUI).
 *
 * The Meta API surfaces 4 collections (photos, albums, videos, playlists).
 * Per the no-tab-ui rule we flatten them into a single ZoruFilesPage and
 * expose a neutral kind selector via DropdownMenu.
 *
 * ZoruFilesPage already composes 5 dialogs internally (preview, rename,
 * delete, share, upload). Upload/rename/delete are stubbed for the
 * Facebook side because Meta's Graph API does not expose generic asset
 * mutation in this surface — see TODOs.
 */

import * as React from 'react';

import { ErrorState, NoProjectState } from '../_components/no-project-state';

type MediaKind = 'photos' | 'albums' | 'videos' | 'playlists';

const KIND_LABELS: Record<MediaKind, string> = {
  photos: 'Photos',
  albums: 'Albums',
  videos: 'Videos',
  playlists: 'Playlists',
};

const KIND_ICONS: Record<MediaKind, React.ComponentType<{ className?: string }>> = {
  photos: ImageIcon,
  albums: FolderOpen,
  videos: Video,
  playlists: ListVideo,
};

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Skeleton className="h-3 w-52" />
      <div className="mt-5 flex items-center justify-between">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="mt-6 h-12 w-full" />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    </div>
  );
}

export default function MediaPage() {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [kind, setKind] = useState<MediaKind>('photos');

  useEffect(() => {
    setIsClient(true);
    setProjectId(localStorage.getItem('activeProjectId'));
  }, []);

  const fetchAll = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const [photosRes, albumsRes, videosRes, playlistsRes] = await Promise.all([
        getPagePhotos(projectId),
        getPageAlbums(projectId),
        getPageVideos(projectId),
        getVideoPlaylists(projectId),
      ]);

      if (photosRes.error) setError(photosRes.error);
      else setPhotos(photosRes.photos || []);

      if (albumsRes.albums) setAlbums(albumsRes.albums);
      if (videosRes.videos) setVideos(videosRes.videos);
      if (playlistsRes.playlists) setPlaylists(playlistsRes.playlists);
    });
  }, [projectId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Adapt the active collection to ZoruFileEntity[].
  const files = useMemo<ZoruFileEntity[]>(() => {
    switch (kind) {
      case 'photos':
        return photos.map((p) => ({
          id: String(p.id),
          name: p.name || `Photo · ${p.id}`,
          mime: 'image/jpeg',
          thumbnailUrl: p.source,
          url: p.source,
          modified: p.created_time ? new Date(p.created_time) : undefined,
        }));
      case 'albums':
        return albums.map((a) => ({
          id: String(a.id),
          name: a.name || `Album · ${a.id}`,
          mime: 'folder',
          thumbnailUrl: a.cover_photo?.source,
          url: a.cover_photo?.source,
          ownerName: typeof a.count === 'number' ? `${a.count} photos` : undefined,
        }));
      case 'videos':
        return videos.map((v) => ({
          id: String(v.id),
          name: v.title || `Video · ${v.id}`,
          mime: 'video/mp4',
          thumbnailUrl: v.picture,
          url: v.permalink_url,
          modified: v.created_time ? new Date(v.created_time) : undefined,
          ownerName:
            typeof v.length === 'number'
              ? `${Math.round(v.length)}s`
              : undefined,
        }));
      case 'playlists':
        return playlists.map((pl) => ({
          id: String(pl.id),
          name: pl.title || `Playlist · ${pl.id}`,
          mime: 'application/x-playlist',
          ownerName:
            typeof pl.videos_count === 'number'
              ? `${pl.videos_count} videos`
              : undefined,
        }));
      default:
        return [];
    }
  }, [kind, photos, albums, videos, playlists]);

  const counts = useMemo(
    () => ({
      photos: photos.length,
      albums: albums.length,
      videos: videos.length,
      playlists: playlists.length,
    }),
    [photos, albums, videos, playlists],
  );

  const handleUpload = useCallback(
    (uploadList: File[]) => {
      // TODO(meta-zoru): Meta's Graph API uploads vary per asset class
      // (photo: /photos, video: /videos, album: /albums). Wire this up
      // once a unified handleUploadFacebookAsset action lands.
      toast({
        title: 'Upload not wired yet',
        description: `${uploadList.length} file${
          uploadList.length === 1 ? '' : 's'
        } selected. Server action pending.`,
      });
    },
    [toast],
  );

  const handleRename = useCallback(
    (file: ZoruFileEntity, name: string) => {
      // TODO(meta-zoru): Meta does not allow generic rename; per-class
      // mutation lives in the post / video editors.
      toast({
        title: 'Rename not supported',
        description: `Rename "${file.name}" → "${name}" is not available via Graph API for this asset.`,
      });
    },
    [toast],
  );

  const handleDelete = useCallback(
    (toDelete: ZoruFileEntity[]) => {
      // TODO(meta-zoru): wire to handleDeletePost-style action per asset
      // class once exposed by facebook.actions.
      toast({
        title: 'Delete not wired yet',
        description: `${toDelete.length} item${
          toDelete.length === 1 ? '' : 's'
        } would be deleted.`,
      });
    },
    [toast],
  );

  const handleDownload = useCallback(
    (file: ZoruFileEntity) => {
      if (!file.url) {
        toast({
          title: 'No download URL',
          description: 'This asset has no direct media URL.',
          variant: 'destructive',
        });
        return;
      }
      window.open(file.url, '_blank', 'noopener,noreferrer');
    },
    [toast],
  );

  if (isLoading && photos.length === 0 && albums.length === 0 && videos.length === 0) {
    return <PageSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Media</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page header */}
      <PageHeader className="mt-4">
        <PageHeading>
          <PageEyebrow>Meta Suite · Library</PageEyebrow>
          <PageTitle>Media</PageTitle>
          <PageDescription>
            Photos, albums, videos and playlists from your connected
            Facebook Page. Switch the asset kind from the dropdown.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {React.createElement(KIND_ICONS[kind])}
                {KIND_LABELS[kind]} · {counts[kind]}
                <ChevronDown className="opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Asset kind</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={kind}
                onValueChange={(v) => setKind(v as MediaKind)}
              >
                {(Object.keys(KIND_LABELS) as MediaKind[]).map((k) => (
                  <DropdownMenuRadioItem key={k} value={k}>
                    {KIND_LABELS[k]} ({counts[k]})
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </PageActions>
      </PageHeader>

      {/* Body */}
      <div className="mt-6">
        {isClient && !projectId ? (
          <NoProjectState />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <ZoruFilesPage
            files={files}
            defaultView="grid"
            onUpload={handleUpload}
            onRename={handleRename}
            onDelete={handleDelete}
            onDownload={handleDownload}
            empty={
              <EmptyState
                icon={React.createElement(KIND_ICONS[kind])}
                title={`No ${KIND_LABELS[kind].toLowerCase()} found`}
                description={`Nothing was returned by the Graph API for this Page in the ${KIND_LABELS[kind].toLowerCase()} collection.`}
              />
            }
          />
        )}
      </div>
    </div>
  );
}
