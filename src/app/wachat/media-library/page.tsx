'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Image as ImageIcon,
  FileText,
  Film,
  Music,
  Upload,
  Trash2,
  Download,
  Pencil,
  Search,
  X,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  deleteMediaItem,
  getMediaLibrary,
  saveMediaItem,
} from '@/app/actions/wachat-features.actions';
import { useZoruToast } from '@/components/zoruui';
import {
  WaPage,
  PageHeader,
  WaButton,
  EmptyState,
  StatusPill,
} from '@/components/wachat-ui';
import { SabFilePickerButton } from '@/components/sabfiles';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

/**
 * Media Library - emerald-themed grid of every reusable asset
 * attached to this project. Drives the same server actions as before
 * (`getMediaLibrary`, `saveMediaItem`, `deleteMediaItem`) and uses the
 * SabFiles picker for any URL ingestion (project policy).
 */

type MediaItem = {
  _id: string;
  name: string;
  url: string;
  type?: string;
  createdAt?: string;
};

type FilterKey = 'all' | 'image' | 'video' | 'audio' | 'document';

const inferType = (mime: string | undefined, name = ''): MediaItem['type'] => {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m.includes('pdf') || m.includes('document') || m.includes('msword')) return 'document';
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
  return 'document';
};

const typeIcon = (t: string | undefined) => {
  switch ((t ?? '').toLowerCase()) {
    case 'image': return ImageIcon;
    case 'video': return Film;
    case 'audio': return Music;
    default: return FileText;
  }
};

const formatDate = (d?: string) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
};

export default function MediaLibraryPage() {
  const reduce = useReducedMotion();
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getMediaLibrary(activeProjectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        setMedia((res.media as MediaItem[]) ?? []);
      }
    });
  }, [activeProjectId, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: media.length, image: 0, video: 0, audio: 0, document: 0 };
    for (const it of media) {
      const t = (it.type ?? 'document') as FilterKey;
      if (t in c) c[t] += 1;
    }
    return c;
  }, [media]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return media
      .filter((it) => (filter === 'all' ? true : (it.type ?? 'document') === filter))
      .filter((it) => (q ? it.name.toLowerCase().includes(q) : true));
  }, [media, filter, search]);

  const handlePickedFile = (file: { url: string; name?: string; mime?: string }) => {
    if (!activeProjectId || !file?.url) return;
    const name = file.name ?? file.url.split('/').pop() ?? 'untitled';
    const type = inferType(file.mime, name) ?? 'image';
    startTransition(async () => {
      const res = await saveMediaItem(activeProjectId, name, file.url, type ?? 'image');
      if (res.error) {
        toast({ title: 'Failed to add', description: res.error, variant: 'destructive' });
      } else {
        toast({ title: 'Added', description: `${name} added to library.` });
        fetchData();
      }
    });
  };

  const handleDelete = (item: MediaItem) => {
    startTransition(async () => {
      const res = await deleteMediaItem(item._id);
      if (res.error) {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      } else {
        toast({ title: 'Removed', description: `${item.name} removed from library.` });
        fetchData();
      }
    });
  };

  const handleRename = (item: MediaItem) => {
    if (!activeProjectId) return;
    const next = window.prompt('Rename file', item.name);
    if (!next || next === item.name) return;
    startTransition(async () => {
      const save = await saveMediaItem(activeProjectId, next, item.url, item.type ?? 'image');
      if (save.error) {
        toast({ title: 'Rename failed', description: save.error, variant: 'destructive' });
        return;
      }
      await deleteMediaItem(item._id);
      toast({ title: 'Renamed', description: `"${item.name}" to "${next}"` });
      fetchData();
    });
  };

  const handleDownload = (item: MediaItem) => {
    const a = document.createElement('a');
    a.href = item.url;
    a.download = item.name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filters: { id: FilterKey; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'image', label: 'Images' },
    { id: 'video', label: 'Videos' },
    { id: 'document', label: 'Documents' },
    { id: 'audio', label: 'Audio' },
  ];

  return (
    <WaPage>
      <PageHeader
        title="Media library"
        description={`Reusable images, videos, documents, and audio for ${activeProject?.name ?? 'this project'}. Pick once, drop into any broadcast or template.`}
        kicker="Wachat · library"
        eyebrowIcon={ImageIcon}
        actions={
          <SabFilePickerButton onPick={handlePickedFile} variant="default">
            Upload media
          </SabFilePickerButton>
        }
      />

      {/* filter pills + search */}
      <m.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
        className="mb-6 flex flex-wrap items-center gap-3"
      >
        <div className="flex flex-wrap gap-1 rounded-full border border-zinc-200 bg-white p-1">
          {filters.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className="relative rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors active:scale-[0.97]"
              >
                {active && (
                  <m.span
                    layoutId="media-filter"
                    className="absolute inset-0 rounded-full"
                    style={{ background: 'var(--mt-accent)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className={`relative z-10 inline-flex items-center gap-1.5 ${active ? 'text-white' : 'text-zinc-600'}`}>
                  {f.label}
                  <span className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${active ? 'bg-white/20' : 'bg-zinc-100 text-zinc-500'}`}>
                    {counts[f.id]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <label className="flex flex-1 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 focus-within:border-zinc-400 sm:max-w-xs">
          <Search className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files"
            className="w-full bg-transparent text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            aria-label="Search media"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
              <X className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-700" strokeWidth={2} />
            </button>
          )}
        </label>
      </m.div>

      {/* grid */}
      {isPending && media.length === 0 ? (
        <GridSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title={media.length === 0 ? 'No media yet' : 'No files match your filter'}
          description={
            media.length === 0
              ? 'Upload an image, video, document, or audio file to reuse it across broadcasts, templates, and chat.'
              : 'Try a different filter or clear your search.'
          }
          action={
            media.length === 0 ? (
              <SabFilePickerButton onPick={handlePickedFile} variant="default">
                Upload your first file
              </SabFilePickerButton>
            ) : (
              <WaButton variant="outline" onClick={() => { setFilter('all'); setSearch(''); }}>
                Clear filters
              </WaButton>
            )
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <AnimatePresence mode="popLayout">
            {filtered.map((item, i) => {
              const Icon = typeIcon(item.type);
              const isImage = (item.type ?? '').toLowerCase() === 'image';
              return (
                <m.li
                  key={item._id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: reduce ? 0 : 0.35, delay: reduce ? 0 : i * 0.04, ease: EASE_OUT }}
                  className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[2px]"
                  style={{ boxShadow: '0 0 0 1px transparent' }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 18px 40px -22px var(--mt-accent-glow)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 0 1px transparent'; }}
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-zinc-50">
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.url} alt={item.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--mt-accent-soft), white)' }}>
                        <Icon className="h-10 w-10" strokeWidth={1.5} style={{ color: 'var(--mt-accent)' }} aria-hidden />
                      </div>
                    )}
                    <span className="absolute left-2 top-2">
                      <StatusPill tone="live">{item.type ?? 'file'}</StatusPill>
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-[12.5px] font-semibold text-zinc-900" title={item.name}>{item.name}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">{formatDate(item.createdAt)}</p>
                  </div>
                  <div className="flex items-center justify-end gap-0.5 border-t border-zinc-100 px-2 py-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <IconBtn label="Rename" onClick={() => handleRename(item)}><Pencil className="h-3.5 w-3.5" strokeWidth={2.25} /></IconBtn>
                    <IconBtn label="Download" onClick={() => handleDownload(item)}><Download className="h-3.5 w-3.5" strokeWidth={2.25} /></IconBtn>
                    <IconBtn label="Delete" onClick={() => handleDelete(item)} danger><Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} /></IconBtn>
                  </div>
                </m.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </WaPage>
  );
}

function IconBtn({ children, onClick, label, danger }: { children: React.ReactNode; onClick: () => void; label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.94] ${danger ? 'hover:!text-rose-600' : ''}`}
    >
      {children}
    </button>
  );
}

function GridSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <li key={i} className="animate-pulse overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="aspect-[4/3] bg-zinc-100" />
          <div className="p-3">
            <div className="h-3 w-3/4 rounded-full bg-zinc-100" />
            <div className="mt-2 h-2.5 w-1/2 rounded-full bg-zinc-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}
