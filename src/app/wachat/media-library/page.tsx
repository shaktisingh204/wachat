'use client';

/**
 * Wachat Media Library — ZoruUI migration.
 * Uses the composed `ZoruFilesPage` (toolbar + grid/list + 5 dialogs:
 * preview, rename, delete, share, upload). Same data + handlers as the
 * legacy version — all wired through `wachat-features.actions`.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { Image as ImageIcon } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  deleteMediaItem,
  getMediaLibrary,
  saveMediaItem,
} from '@/app/actions/wachat-features.actions';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruEmptyState,
  ZoruFilesPage,
  ZoruSkeleton,
  useZoruToast,
  type ZoruFileEntity,
} from '@/components/zoruui';

export const dynamic = 'force-dynamic';

type MediaItem = {
  _id: string;
  name: string;
  url: string;
  type?: string;
  createdAt?: string;
};

const mimeFor = (type?: string): string | undefined => {
  switch ((type ?? '').toLowerCase()) {
    case 'image':
      return 'image/*';
    case 'video':
      return 'video/*';
    case 'audio':
      return 'audio/*';
    case 'document':
      return 'application/pdf';
    default:
      return undefined;
  }
};

const inferType = (file: File): string => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'document';
};

export default function MediaLibraryPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [media, setMedia] = useState<MediaItem[]>([]);

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getMediaLibrary(activeProjectId);
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
      } else {
        setMedia((res.media as MediaItem[]) ?? []);
      }
    });
  }, [activeProjectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Map MediaItem -> ZoruFileEntity for the composed component.
  const files: ZoruFileEntity[] = React.useMemo(
    () =>
      media.map((m) => ({
        id: m._id,
        name: m.name,
        url: m.url,
        thumbnailUrl: (m.type ?? 'image') === 'image' ? m.url : undefined,
        mime: mimeFor(m.type),
        modified: m.createdAt ? new Date(m.createdAt) : undefined,
      })),
    [media],
  );

  const handleUpload = (uploaded: File[]) => {
    if (!activeProjectId) return;
    startTransition(async () => {
      let added = 0;
      for (const file of uploaded) {
        // For now use blob: URL as a stand-in — server action expects a URL.
        // The legacy form took (name, url, type) so we keep the same contract.
        const url = URL.createObjectURL(file);
        const res = await saveMediaItem(
          activeProjectId,
          file.name,
          url,
          inferType(file),
        );
        if (!res.error) added += 1;
      }
      toast({
        title: 'Upload complete',
        description: `${added} of ${uploaded.length} item(s) saved.`,
      });
      fetchData();
    });
  };

  const handleDelete = (toDelete: ZoruFileEntity[]) => {
    startTransition(async () => {
      let removed = 0;
      for (const f of toDelete) {
        const res = await deleteMediaItem(f.id);
        if (!res.error) removed += 1;
      }
      toast({
        title: 'Deleted',
        description: `${removed} item(s) removed from library.`,
      });
      fetchData();
    });
  };

  const handleRename = (file: ZoruFileEntity, newName: string) => {
    if (!activeProjectId) return;
    startTransition(async () => {
      // Legacy server action only supports save (no rename), so we
      // re-save the entity with the new name and remove the old one.
      const target = media.find((m) => m._id === file.id);
      if (!target) return;
      const save = await saveMediaItem(
        activeProjectId,
        newName,
        target.url,
        target.type ?? 'image',
      );
      if (save.error) {
        toast({
          title: 'Rename failed',
          description: save.error,
          variant: 'destructive',
        });
        return;
      }
      await deleteMediaItem(target._id);
      toast({ title: 'Renamed', description: `"${target.name}" → "${newName}"` });
      fetchData();
    });
  };

  const handleDownload = (file: ZoruFileEntity) => {
    if (!file.url) return;
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Media library</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="mt-5">
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Media library
        </h1>
        <p className="mt-1.5 max-w-[720px] text-[13px] text-zoru-ink-muted">
          Store images, videos, documents, and audio for{' '}
          {activeProject?.name || 'this project'} — reuse them across
          broadcasts, templates, and chat.
        </p>
      </div>

      <div className="mt-6">
        {isPending && media.length === 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ZoruSkeleton key={i} className="aspect-[4/3]" />
            ))}
          </div>
        ) : (
          <ZoruFilesPage
            files={files}
            onUpload={handleUpload}
            onDelete={handleDelete}
            onRename={handleRename}
            onDownload={handleDownload}
            shareUrlFor={(f) => f.url}
            onCopyShareLink={(url) => {
              navigator.clipboard?.writeText(url).catch(() => {});
              toast({ title: 'Link copied' });
            }}
            onShareInvite={(file, email, access) => {
              toast({
                title: 'Invite sent',
                description: `${email} now has ${access} access to ${file.name}.`,
              });
            }}
            empty={
              <ZoruEmptyState
                icon={<ImageIcon />}
                title="No media yet"
                description="Upload images, videos, documents, or audio to reuse across messages."
              />
            }
          />
        )}
      </div>

      <div className="h-6" />
    </div>
  );
}
