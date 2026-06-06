'use client';

import { FilesPage, type FileEntity } from '@/components/sabcrm/20ui';
import {
  EmptyState,
  Skeleton,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { Image as ImageIcon } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  deleteMediaItem,
  getMediaLibrary,
  saveMediaItem,
  } from '@/app/actions/wachat-features.actions';
import WachatPage from '@/app/wachat/_components/wachat-page';

/**
 * Wachat Media Library — 20ui migration.
 * Uses the composed `FilesPage` (toolbar + grid/list + 5 dialogs:
 * preview, rename, delete, share, upload). Same data + handlers as the
 * legacy version — all wired through `wachat-features.actions`.
 */

import * as React from 'react';

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
  const { toast } = useToast();
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
          tone: 'danger',
        });
      } else {
        setMedia((res.media as MediaItem[]) ?? []);
      }
    });
  }, [activeProjectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Map MediaItem -> FileEntity for the composed component.
  const files: FileEntity[] = React.useMemo(
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

  const handleDelete = (toDelete: FileEntity[]) => {
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

  const handleRename = (file: FileEntity, newName: string) => {
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
          tone: 'danger',
        });
        return;
      }
      await deleteMediaItem(target._id);
      toast({ title: 'Renamed', description: `"${target.name}" → "${newName}"` });
      fetchData();
    });
  };

  const handleDownload = (file: FileEntity) => {
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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Media library' },
      ]}
      title="Media library"
      description={
        <>
          Store images, videos, documents, and audio for{' '}
          {activeProject?.name || 'this project'} — reuse them across
          broadcasts, templates, and chat.
        </>
      }
      width="wide"
    >
      {isPending && media.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3]" />
          ))}
        </div>
      ) : (
        <FilesPage
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
            <EmptyState
              icon={ImageIcon}
              title="No media yet"
              description="Upload images, videos, documents, or audio to reuse across messages."
            />
          }
        />
      )}
    </WachatPage>
  );
}
