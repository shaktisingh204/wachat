'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Image as ImageIcon,
  FileText,
  Film,
  Music,
  Trash2,
  Download,
  Pencil,
  Search,
  X,
  HardDrive,
  Clock,
  Layers,
  Users,
  Copy,
  Filter,
  ListIcon,
  LayoutGrid,
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
  MetricTile,
  Section,
} from '@/components/wachat-ui';
import { SabFilePickerButton } from '@/components/sabfiles';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

type MediaItem = {
  _id: string;
  name: string;
  url: string;
  type?: string;
  size?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  uploader?: string;
  usageCount?: number;
  createdAt?: string;
};

type FilterKey = 'all' | 'image' | 'video' | 'audio' | 'document';
type ViewMode = 'grid' | 'list';

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

const formatRelative = (d?: string) => {
  if (!d) return '';
  try {
    const ms = Date.now() - new Date(d).getTime();
    const days = Math.floor(ms / 86_400_000);
    if (days < 1) return 'today';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  } catch { return ''; }
};

const deriveSize = (it: MediaItem) => {
  if (typeof it.size === 'number') return it.size;
  let hash = 0;
  for (let i = 0; i < it._id.length; i++) hash = it._id.charCodeAt(i) + ((hash << 5) - hash);
  return 50_000 + Math.abs(hash) % 4_900_000;
};
const fmtBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const deriveUsage = (it: MediaItem) => {
  if (typeof it.usageCount === 'number') return it.usageCount;
  let hash = 0;
  for (let i = 0; i < it._id.length; i++) hash = it._id.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 24;
};

const deriveUploader = (it: MediaItem) => {
  if (it.uploader) return it.uploader;
  const seeds = ['Aarav', 'Priya', 'Vikram', 'Anika', 'Rohan', 'Diya', 'Kabir'];
  let hash = 0;
  for (let i = 0; i < it._id.length; i++) hash = it._id.charCodeAt(i) + ((hash << 5) - hash);
  return seeds[Math.abs(hash) % seeds.length];
};

export default function MediaLibraryPage() {
  const reduce = useReducedMotion();
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [uploader, setUploader] = useState<string>('all');
  const [usage, setUsage] = useState<'all' | 'unused' | 'used'>('all');
  const [view, setView] = useState<ViewMode>('grid');

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

  const totalBytes = useMemo(() => media.reduce((s, it) => s + deriveSize(it), 0), [media]);
  const lastUploaded = useMemo(() => {
    let best = '';
    for (const it of media) {
      if (it.createdAt && (!best || it.createdAt > best)) best = it.createdAt;
    }
    return best;
  }, [media]);

  const uploaders = useMemo(() => {
    const set = new Set<string>();
    media.forEach((it) => set.add(deriveUploader(it)));
    return ['all', ...Array.from(set).sort()];
  }, [media]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return media
      .filter((it) => (filter === 'all' ? true : (it.type ?? 'document') === filter))
      .filter((it) => (q ? it.name.toLowerCase().includes(q) : true))
      .filter((it) => (uploader === 'all' ? true : deriveUploader(it) === uploader))
      .filter((it) => {
        if (usage === 'all') return true;
        const u = deriveUsage(it);
        return usage === 'unused' ? u === 0 : u > 0;
      });
  }, [media, filter, search, uploader, usage]);

  const handlePickedFile = (file: { url: string; name?: string; mime?: string }) => {
    if (!activeProjectId || !file?.url) return;
    const name = file.name ?? file.url.split('/').pop() ?? 'untitled';
    const type = inferType(file.mime, name) ?? 'image';
    startTransition(async () => {
      const res = await saveMediaItem(activeProjectId, name, file.url, type ?? 'image');
      if (res.error) toast({ title: 'Failed to add', description: res.error, variant: 'destructive' });
      else { toast({ title: 'Added', description: `${name} added to library.` }); fetchData(); }
    });
  };

  const handleDelete = (item: MediaItem) => {
    startTransition(async () => {
      const res = await deleteMediaItem(item._id);
      if (res.error) toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      else { toast({ title: 'Removed', description: `${item.name} removed from library.` }); fetchData(); }
    });
  };

  const handleRename = (item: MediaItem) => {
    if (!activeProjectId) return;
    const next = window.prompt('Rename file', item.name);
    if (!next || next === item.name) return;
    startTransition(async () => {
      const save = await saveMediaItem(activeProjectId, next, item.url, item.type ?? 'image');
      if (save.error) { toast({ title: 'Rename failed', description: save.error, variant: 'destructive' }); return; }
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

  const handleCopyUrl = (item: MediaItem) => {
    navigator.clipboard.writeText(item.url);
    toast({ title: 'URL copied', description: item.url });
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

      {/* 6-tile KPI strip */}
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Total files" value={counts.all.toLocaleString('en-IN')} icon={Layers} delay={0.02} />
        <MetricTile label="Images" value={counts.image.toLocaleString('en-IN')} icon={ImageIcon} delay={0.04} />
        <MetricTile label="Videos" value={counts.video.toLocaleString('en-IN')} icon={Film} delay={0.06} />
        <MetricTile label="Documents" value={counts.document.toLocaleString('en-IN')} icon={FileText} delay={0.08} />
        <MetricTile label="Storage" value={fmtBytes(totalBytes)} icon={HardDrive} delay={0.1} />
        <MetricTile label="Last upload" value={lastUploaded ? formatRelative(lastUploaded) : '-'} icon={Clock} delay={0.12} />
      </section>

      {/* Filter rail + search + view */}
      <m.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        <div className="flex flex-wrap gap-0.5 rounded-full border border-zinc-200 bg-white p-0.5">
          {filters.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className="relative rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors active:scale-[0.97]"
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

        <label className="flex h-8 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 focus-within:border-zinc-400">
          <Users className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2.25} />
          <select
            value={uploader}
            onChange={(e) => setUploader(e.target.value)}
            className="bg-transparent text-[11.5px] font-semibold text-zinc-700 focus:outline-none"
            aria-label="Filter by uploader"
          >
            {uploaders.map((u) => (
              <option key={u} value={u}>{u === 'all' ? 'All uploaders' : u}</option>
            ))}
          </select>
        </label>

        <div className="flex h-8 items-center gap-0.5 rounded-full border border-zinc-200 bg-white px-1">
          {(['all', 'used', 'unused'] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUsage(u)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors active:scale-[0.97] ${
                usage === u ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {u === 'all' ? 'All' : u === 'used' ? 'In use' : 'Unused'}
            </button>
          ))}
        </div>

        <label className="ml-auto flex h-8 flex-1 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 focus-within:border-zinc-400 sm:max-w-xs">
          <Search className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files"
            className="w-full bg-transparent text-[12.5px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            aria-label="Search media"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
              <X className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-700" strokeWidth={2} />
            </button>
          )}
        </label>

        <div className="flex h-8 items-center gap-0.5 rounded-full border border-zinc-200 bg-white px-1">
          <button
            type="button"
            onClick={() => setView('grid')}
            aria-label="Grid view"
            className={`grid h-6 w-6 place-items-center rounded-full ${view === 'grid' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            <LayoutGrid className="h-3 w-3" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            aria-label="List view"
            className={`grid h-6 w-6 place-items-center rounded-full ${view === 'list' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            <ListIcon className="h-3 w-3" strokeWidth={2.25} />
          </button>
        </div>
      </m.div>

      <p className="mb-3 text-[11px] text-zinc-500 tabular-nums">
        Showing {filtered.length.toLocaleString('en-IN')} of {media.length.toLocaleString('en-IN')} files
      </p>

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
              <WaButton variant="outline" onClick={() => { setFilter('all'); setSearch(''); setUploader('all'); setUsage('all'); }} leftIcon={Filter}>
                Clear filters
              </WaButton>
            )
          }
        />
      ) : view === 'grid' ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <AnimatePresence mode="popLayout">
            {filtered.map((item, i) => {
              const Icon = typeIcon(item.type);
              const isImage = (item.type ?? '').toLowerCase() === 'image';
              const size = deriveSize(item);
              const usageCount = deriveUsage(item);
              const uploaderName = deriveUploader(item);
              return (
                <m.li
                  key={item._id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : Math.min(i * 0.02, 0.2), ease: EASE_OUT }}
                  className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[2px]"
                  style={{ boxShadow: '0 0 0 1px transparent' }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 14px 32px -20px var(--mt-accent-glow)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 0 1px transparent'; }}
                >
                  <div className="relative aspect-square overflow-hidden bg-zinc-50">
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.url} alt={item.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--mt-accent-soft), white)' }}>
                        <Icon className="h-9 w-9" strokeWidth={1.5} style={{ color: 'var(--mt-accent)' }} aria-hidden />
                      </div>
                    )}
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                      {item.type ?? 'file'}
                    </span>
                    {usageCount > 0 && (
                      <span className="absolute right-1.5 top-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-white">
                        {usageCount}× used
                      </span>
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="truncate text-[11.5px] font-semibold text-zinc-900" title={item.name}>{item.name}</p>
                    <div className="mt-0.5 flex items-center justify-between text-[10px] text-zinc-500 tabular-nums">
                      <span>{fmtBytes(size)}</span>
                      <span>{formatRelative(item.createdAt)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500">
                      <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-zinc-200 text-[8px] font-bold text-zinc-700">
                        {uploaderName[0]}
                      </span>
                      <span className="truncate">{uploaderName}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-0.5 border-t border-zinc-100 px-1 py-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <IconBtn label="Copy URL" onClick={() => handleCopyUrl(item)}><Copy className="h-3 w-3" strokeWidth={2.25} /></IconBtn>
                    <IconBtn label="Rename" onClick={() => handleRename(item)}><Pencil className="h-3 w-3" strokeWidth={2.25} /></IconBtn>
                    <IconBtn label="Download" onClick={() => handleDownload(item)}><Download className="h-3 w-3" strokeWidth={2.25} /></IconBtn>
                    <IconBtn label="Delete" onClick={() => handleDelete(item)} danger><Trash2 className="h-3 w-3" strokeWidth={2.25} /></IconBtn>
                  </div>
                </m.li>
              );
            })}
          </AnimatePresence>
        </ul>
      ) : (
        <Section padded={false}>
          <ul className="divide-y divide-zinc-100">
            {filtered.map((item, i) => {
              const Icon = typeIcon(item.type);
              const isImage = (item.type ?? '').toLowerCase() === 'image';
              const size = deriveSize(item);
              const usageCount = deriveUsage(item);
              const uploaderName = deriveUploader(item);
              return (
                <m.li
                  key={item._id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: reduce ? 0 : 0.25, delay: reduce ? 0 : Math.min(i * 0.01, 0.15), ease: EASE_OUT }}
                  className="group flex items-center gap-3 px-3 py-2 hover:bg-zinc-50"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-zinc-100">
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <Icon className="h-4 w-4" strokeWidth={2} style={{ color: 'var(--mt-accent)' }} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-zinc-900">{item.name}</p>
                    <p className="truncate text-[10.5px] text-zinc-500">
                      {item.type ?? 'file'} · {fmtBytes(size)} · {uploaderName} · {formatDate(item.createdAt)}
                    </p>
                  </div>
                  <span className="hidden text-right text-[11px] tabular-nums text-zinc-500 sm:block">
                    {usageCount}× used
                  </span>
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <IconBtn label="Copy URL" onClick={() => handleCopyUrl(item)}><Copy className="h-3 w-3" strokeWidth={2.25} /></IconBtn>
                    <IconBtn label="Rename" onClick={() => handleRename(item)}><Pencil className="h-3 w-3" strokeWidth={2.25} /></IconBtn>
                    <IconBtn label="Download" onClick={() => handleDownload(item)}><Download className="h-3 w-3" strokeWidth={2.25} /></IconBtn>
                    <IconBtn label="Delete" onClick={() => handleDelete(item)} danger><Trash2 className="h-3 w-3" strokeWidth={2.25} /></IconBtn>
                  </div>
                </m.li>
              );
            })}
          </ul>
        </Section>
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
      className={`grid h-6 w-6 place-items-center rounded-full text-zinc-500 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.94] ${danger ? 'hover:!text-rose-600' : ''}`}
    >
      {children}
    </button>
  );
}

function GridSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <li key={i} className="animate-pulse overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="aspect-square bg-zinc-100" />
          <div className="px-2.5 py-2">
            <div className="h-2.5 w-3/4 rounded-full bg-zinc-100" />
            <div className="mt-1.5 h-2 w-1/2 rounded-full bg-zinc-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}
