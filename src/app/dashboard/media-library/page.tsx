'use client';

/**
 * Wachat Media Library — store and manage reusable media assets.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import {
  LuImage, LuVideo, LuFileText, LuMusic, LuPlus, LuTrash2, LuExternalLink,
} from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import {
  getMediaLibrary,
  saveMediaItem,
  deleteMediaItem,
} from '@/app/actions/wachat-features.actions';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';

export const dynamic = 'force-dynamic';

const TYPE_OPTIONS = ['image', 'video', 'document', 'audio'] as const;

const typeIcon: Record<string, React.ReactNode> = {
  image: <LuImage className="h-5 w-5" />,
  video: <LuVideo className="h-5 w-5" />,
  document: <LuFileText className="h-5 w-5" />,
  audio: <LuMusic className="h-5 w-5" />,
};

export default function MediaLibraryPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [media, setMedia] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<string>('image');

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getMediaLibrary(activeProjectId);
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else setMedia(res.media ?? []);
    });
  }, [activeProjectId, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = () => {
    if (!activeProjectId || !name.trim() || !url.trim()) return;
    startTransition(async () => {
      const res = await saveMediaItem(activeProjectId, name.trim(), url.trim(), type);
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else {
        toast({ title: 'Saved', description: res.message ?? 'Media item saved.' });
        setName(''); setUrl(''); setType('image'); setShowForm(false);
        fetchData();
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteMediaItem(id);
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else { toast({ title: 'Deleted', description: 'Media item removed.' }); fetchData(); }
    });
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Media Library' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
            Media Library
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[13px] text-clay-ink-muted">
            Store images, videos, documents, and audio for quick use in messages.
          </p>
        </div>
        <ClayButton size="sm" onClick={() => setShowForm(!showForm)}>
          <LuPlus className="mr-1.5 h-3.5 w-3.5" /> Add Media
        </ClayButton>
      </div>

      {showForm && (
        <ClayCard className="p-5">
          <h3 className="text-sm font-medium text-clay-ink mb-3">Add Media Item</h3>
          <div className="flex flex-wrap gap-3">
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Name" className="flex-1 min-w-[160px] rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none"
            />
            <input
              type="url" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="URL" className="flex-[2] min-w-[200px] rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none"
            />
            <select
              value={type} onChange={(e) => setType(e.target.value)}
              className="rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink focus:border-clay-accent focus:outline-none"
            >
              {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <ClayButton size="sm" onClick={handleSave} disabled={isPending || !name.trim() || !url.trim()}>
              Save
            </ClayButton>
          </div>
        </ClayCard>
      )}

      {media.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {media.map((m) => (
            <ClayCard key={m._id} padded={false} className="flex flex-col p-5">
              {/* Preview */}
              <div className="flex h-24 items-center justify-center rounded-lg bg-clay-bg-2 mb-4 overflow-hidden">
                {m.type === 'image' ? (
                  <img src={m.url} alt={m.name} className="h-full w-full object-cover rounded-lg" />
                ) : (
                  <span className="text-clay-ink-muted">{typeIcon[m.type] ?? typeIcon.document}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex-1 truncate text-[14px] font-semibold text-clay-ink">{m.name}</span>
                <ClayBadge>{m.type}</ClayBadge>
              </div>
              <a
                href={m.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-clay-accent hover:underline mb-3 truncate"
              >
                <LuExternalLink className="h-3 w-3 shrink-0" /> {m.url}
              </a>
              <div className="mt-auto">
                <button
                  onClick={() => handleDelete(m._id)} disabled={isPending}
                  className="flex items-center gap-1 text-[12px] text-clay-ink-muted hover:text-red-500 transition-colors"
                >
                  <LuTrash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </ClayCard>
          ))}
        </div>
      ) : (
        !isPending && (
          <ClayCard className="p-12 text-center">
            <LuImage className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
            <p className="text-sm text-clay-ink-muted">No media items yet. Add one to get started.</p>
          </ClayCard>
        )
      )}
    </div>
  );
}
