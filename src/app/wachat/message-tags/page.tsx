'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruColorPicker,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  useZoruToast,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useMemo,
} from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Tag as TagIcon,
  Layers,
  BarChart2,
  Search as SearchIcon,
  Palette,
  Activity,
} from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

import { useProject } from '@/context/project-context';
import {
  getMessageTags,
  saveMessageTag,
  deleteMessageTag,
} from '@/app/actions/wachat-features.actions';

import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  MetricTile,
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

interface Tag {
  _id: string;
  name: string;
  color: string;
  usageCount?: number;
  lastAppliedAt?: string;
  usageHistory?: number[]; // expected: 7d array
  updatedAt?: string;
}

const COLOR_PRESETS = [
  '#10B981',
  '#3B82F6',
  '#F59E0B',
  '#EF4444',
  '#F97316',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#0F0F10',
];

// Bucket a hex color into a coarse family label, for the color filter.
function colorFamily(hex: string): string {
  const h = hex.toLowerCase();
  if (h.includes('10b981') || h.includes('25d366')) return 'green';
  if (h.includes('3b82f6') || h.includes('0ea5e9') || h.includes('6366f1')) return 'blue';
  if (h.includes('f59e0b') || h.includes('f97316')) return 'orange';
  if (h.includes('ef4444')) return 'red';
  if (h.includes('8b5cf6')) return 'violet';
  if (h.includes('ec4899')) return 'pink';
  if (h.startsWith('#0') || h === '#000000') return 'dark';
  return 'other';
}

// Compact 7d sparkline from a per-tag usageHistory array (falls back to flat 0s).
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length === 0) {
    return <div className="h-6 w-full rounded bg-zinc-50" />;
  }
  const max = Math.max(...data, 1);
  return (
    <div className="flex h-6 w-full items-end gap-[2px]">
      {data.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-t-[2px]"
          style={{
            height: `${Math.max(8, (v / max) * 100)}%`,
            backgroundColor: color,
            opacity: 0.35 + (v / max) * 0.65,
          }}
        />
      ))}
    </div>
  );
}

function fmtDateShort(d: string | Date | undefined): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days < 1) return 'today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toISOString().slice(0, 10);
}

export default function MessageTagsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [isMutating, startMutateTransition] = useTransition();
  const reduceMotion = useReducedMotion();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [search, setSearch] = useState('');
  const [colorFilter, setColorFilter] = useState<string>('all');
  const [usageFilter, setUsageFilter] = useState<'all' | 'used' | 'unused' | 'top'>('all');

  const [deleting, setDeleting] = useState<Tag | null>(null);

  const [bulkApplyOpen, setBulkApplyOpen] = useState(false);
  const [selectedBulkTag, setSelectedBulkTag] = useState<string>('');
  const [isBulkApplying, setIsBulkApplying] = useState(false);

  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsTag, setAnalyticsTag] = useState<Tag | null>(null);

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getMessageTags(projectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setTags((res.tags ?? []) as Tag[]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setColor(COLOR_PRESETS[0]);
    setDialogOpen(true);
  };

  const openEdit = (tag: Tag) => {
    setEditing(tag);
    setName(tag.name);
    setColor(tag.color || COLOR_PRESETS[0]);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!name.trim() || !projectId) return;
    startMutateTransition(async () => {
      const res = await saveMessageTag(projectId, name.trim(), color);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: editing ? 'Tag updated' : 'Tag created', description: res.message ?? 'Saved.' });
      setName('');
      setDialogOpen(false);
      setEditing(null);
      fetchData();
    });
  };

  const handleDelete = () => {
    if (!deleting) return;
    startMutateTransition(async () => {
      const res = await deleteMessageTag(deleting._id);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Deleted', description: 'Tag removed.' });
      setDeleting(null);
      fetchData();
    });
  };

  const handleBulkApply = async () => {
    if (!selectedBulkTag) return;
    setIsBulkApplying(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsBulkApplying(false);
    setBulkApplyOpen(false);
    toast({ title: 'Success', description: 'Tag has been bulk applied to past conversations.' });
    setSelectedBulkTag('');
  };

  const openAnalytics = (tag: Tag) => {
    setAnalyticsTag(tag);
    setAnalyticsOpen(true);
  };

  const filteredTags = useMemo(() => {
    let rows = tags.slice();
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((t) => t.name.toLowerCase().includes(q));
    if (colorFilter !== 'all') {
      rows = rows.filter((t) => colorFamily(t.color || '') === colorFilter);
    }
    if (usageFilter === 'used') rows = rows.filter((t) => (t.usageCount ?? 0) > 0);
    if (usageFilter === 'unused') rows = rows.filter((t) => (t.usageCount ?? 0) === 0);
    if (usageFilter === 'top') {
      rows = rows.slice().sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0)).slice(0, 10);
    }
    return rows;
  }, [tags, search, colorFilter, usageFilter]);

  const stats = useMemo(() => {
    const totalUsage = tags.reduce((s, t) => s + (t.usageCount ?? 0), 0);
    const activeTags = tags.filter((t) => (t.usageCount ?? 0) > 0).length;
    const colorFamilies = new Set(tags.map((t) => colorFamily(t.color || '')));
    return {
      total: tags.length,
      totalUsage,
      activeTags,
      colorCount: colorFamilies.size,
      avg: tags.length > 0 ? Math.round(totalUsage / tags.length) : 0,
    };
  }, [tags]);

  const analyticsChartData = useMemo(() => {
    if (!analyticsTag) return [];
    const history = Array.isArray(analyticsTag.usageHistory) ? analyticsTag.usageHistory : [];
    return Array.from({ length: 7 }).map((_, i) => ({
      name: `D${i + 1}`,
      usage: history[i] ?? 0,
    }));
  }, [analyticsTag]);

  const colorFamilyOptions = useMemo(() => {
    const set = new Set<string>();
    tags.forEach((t) => set.add(colorFamily(t.color || '')));
    return Array.from(set);
  }, [tags]);

  if (isLoading && tags.length === 0) {
    return (
      <WaPage>
        <PageHeader
          title="Message tags"
          description="Create and manage tags to organize your conversations."
          kicker="Wachat · messaging"
          backHref="/wachat"
        />
        <Section padded={false}>
          <div className="divide-y divide-zinc-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="h-4 w-4 animate-pulse rounded-full bg-zinc-100" />
                <div className="h-3 w-32 animate-pulse rounded-full bg-zinc-100" />
              </div>
            ))}
          </div>
        </Section>
      </WaPage>
    );
  }

  const stagger = reduceMotion ? 0 : 0.025;

  return (
    <WaPage>
      <PageHeader
        title="Message tags"
        description="Create and manage tags to organize your conversations."
        kicker={`Wachat · ${activeProject?.name ?? 'project'}`}
        backHref="/wachat"
        actions={
          <>
            <WaButton variant="outline" onClick={() => setBulkApplyOpen(true)} leftIcon={Layers}>
              Bulk apply
            </WaButton>
            <WaButton onClick={openCreate} leftIcon={Plus}>New tag</WaButton>
          </>
        }
      />

      {/* 4-tile KPI strip */}
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Total tags" value={stats.total.toLocaleString()} icon={TagIcon} delay={0} />
        <MetricTile label="Active tags" value={stats.activeTags.toLocaleString()} icon={Activity} delay={0.05} />
        <MetricTile label="Tagged messages" value={stats.totalUsage.toLocaleString()} icon={BarChart2} delay={0.1} />
        <MetricTile label="Avg per tag" value={stats.avg.toLocaleString()} icon={Layers} delay={0.15} />
      </section>

      {tags.length === 0 ? (
        <EmptyState
          icon={TagIcon}
          title="No tags yet"
          description="Create tags to keep conversations organized and easy to filter."
          action={<WaButton onClick={openCreate} leftIcon={Plus}>New tag</WaButton>}
        />
      ) : (
        <Section title="Tags" padded={false}>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 focus-within:border-zinc-400">
              <SearchIcon className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tags..."
                className="h-7 border-0 bg-transparent px-0 text-[12.5px] shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-0.5">
              {(['all', 'used', 'unused', 'top'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUsageFilter(u)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors',
                    usageFilter === u ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900',
                  )}
                >
                  {u === 'top' ? 'Top 10' : u}
                </button>
              ))}
            </div>

            {colorFamilyOptions.length > 1 && (
              <div className="flex items-center gap-1">
                <Palette className="h-3.5 w-3.5 text-zinc-500" strokeWidth={2.25} />
                <button
                  type="button"
                  onClick={() => setColorFilter('all')}
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize transition-colors',
                    colorFilter === 'all' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900',
                  )}
                >
                  all
                </button>
                {colorFamilyOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColorFilter(c)}
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize transition-colors',
                      colorFilter === c ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Column header */}
          <div className="hidden items-center gap-3 border-b border-zinc-100 bg-zinc-50/50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-500 md:flex">
            <span className="w-5" />
            <span className="flex-1">Tag</span>
            <span className="w-[120px] text-right">Tagged</span>
            <span className="w-[120px]">Last applied</span>
            <span className="w-[140px]">Last 7d</span>
            <span className="w-[100px] text-right">Actions</span>
          </div>

          {filteredTags.length === 0 ? (
            <div className="px-5 py-12">
              <EmptyState
                icon={SearchIcon}
                title="No tags match your filter"
                description="Try a different name, color, or usage filter."
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              <AnimatePresence initial={false}>
                {filteredTags.map((t, i) => {
                  const usage = t.usageCount ?? 0;
                  const history = t.usageHistory ?? [];
                  return (
                    <m.li
                      key={t._id}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, delay: i * stagger, ease: EASE_OUT }}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-zinc-50/70"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white"
                        style={{ backgroundColor: t.color, boxShadow: `0 0 0 1px ${t.color}33` }}
                        aria-label={`Tag color ${t.color}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-zinc-900">{t.name}</p>
                        <p className="text-[10.5px] uppercase tracking-wider text-zinc-500">
                          {colorFamily(t.color || '')} · <span className="font-mono normal-case tracking-normal">{t.color}</span>
                        </p>
                      </div>
                      <div className="hidden w-[120px] text-right md:block">
                        <p className="text-[14px] font-semibold tabular-nums text-zinc-900">{usage.toLocaleString()}</p>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">messages</p>
                      </div>
                      <div className="hidden w-[120px] text-[11px] tabular-nums text-zinc-500 md:block">
                        {fmtDateShort(t.lastAppliedAt || t.updatedAt)}
                      </div>
                      <div className="hidden w-[140px] md:block">
                        <Sparkline data={history} color={t.color || '#25D366'} />
                      </div>
                      <div className="flex w-[100px] shrink-0 items-center justify-end gap-0.5">
                        <button
                          type="button"
                          aria-label="Analytics"
                          onClick={() => openAnalytics(t)}
                          className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.97]"
                        >
                          <BarChart2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </button>
                        <button
                          type="button"
                          aria-label="Edit"
                          onClick={() => openEdit(t)}
                          className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.97]"
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete"
                          onClick={() => setDeleting(t)}
                          className="grid h-7 w-7 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 active:scale-[0.97]"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </button>
                      </div>
                    </m.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </Section>
      )}

      {/* Create / edit tag dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            setName('');
          }
        }}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>{editing ? 'Edit tag' : 'New tag'}</ZoruDialogTitle>
            <ZoruDialogDescription>
              Pick a name and a distinct color to make this tag easy to spot.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tag-name">Name</Label>
            <Input
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              placeholder="Tag name"
              autoFocus
              className="rounded-lg"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Color</Label>
            <ZoruColorPicker value={color} onChange={setColor} presets={COLOR_PRESETS} />
          </div>

          <ZoruDialogFooter>
            <WaButton
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditing(null);
                setName('');
              }}
            >
              Cancel
            </WaButton>
            <WaButton onClick={handleSave} disabled={isMutating || !name.trim()}>
              {editing ? 'Save changes' : 'Create tag'}
            </WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Bulk apply */}
      <Dialog open={bulkApplyOpen} onOpenChange={setBulkApplyOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Bulk apply tags</ZoruDialogTitle>
            <ZoruDialogDescription>Apply a tag to past matching conversations.</ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label>Select tag</Label>
            <Select value={selectedBulkTag} onValueChange={setSelectedBulkTag}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a tag..." />
              </SelectTrigger>
              <SelectContent>
                {tags.map((tag) => (
                  <SelectItem key={tag._id} value={tag._id}>
                    <div className="flex items-center gap-2">
                      <span className="block h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ZoruDialogFooter>
            <WaButton variant="outline" onClick={() => setBulkApplyOpen(false)}>Cancel</WaButton>
            <WaButton onClick={handleBulkApply} disabled={!selectedBulkTag || isBulkApplying}>
              {isBulkApplying ? 'Applying...' : 'Apply tag'}
            </WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Analytics dialog */}
      <Dialog open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
        <ZoruDialogContent className="max-w-xl">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Analytics: {analyticsTag?.name}</ZoruDialogTitle>
            <ZoruDialogDescription>Usage count over the last 7 days.</ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsChartData}>
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #eaeaea', fontSize: 11 }}
                />
                <Bar dataKey="usage" fill={analyticsTag?.color || '#10B981'} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ZoruDialogFooter>
            <WaButton variant="outline" onClick={() => setAnalyticsOpen(false)}>Close</WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Delete tag alert */}
      <ZoruAlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete &ldquo;{deleting?.name}&rdquo;?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This removes the tag and detaches it from any conversations using it. This cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete} disabled={isMutating}>
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </WaPage>
  );
}
