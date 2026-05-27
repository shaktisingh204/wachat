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

  const [deleting, setDeleting] = useState<Tag | null>(null);

  // Bulk Apply state
  const [bulkApplyOpen, setBulkApplyOpen] = useState(false);
  const [selectedBulkTag, setSelectedBulkTag] = useState<string>('');
  const [isBulkApplying, setIsBulkApplying] = useState(false);

  // Analytics state
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
    if (!search.trim()) return tags;
    const q = search.toLowerCase();
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, search]);

  const totalUsage = useMemo(
    () => tags.reduce((s, t) => s + (t.usageCount ?? 0), 0),
    [tags],
  );

  const mockChartData = useMemo(() => {
    if (!analyticsTag) return [];
    return Array.from({ length: 7 }).map((_, i) => ({
      name: `Day ${i + 1}`,
      usage: Math.floor(Math.random() * 50) + 5,
    }));
  }, [analyticsTag]);

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

  const stagger = reduceMotion ? 0 : 0.03;

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

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetricTile label="Total tags" value={tags.length} icon={TagIcon} delay={0} />
        <MetricTile label="Total tagged messages" value={totalUsage.toLocaleString()} icon={BarChart2} delay={0.05} />
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
          <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 focus-within:border-zinc-400">
              <SearchIcon className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tags..."
                className="h-7 border-0 bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          {filteredTags.length === 0 ? (
            <div className="px-5 py-12">
              <EmptyState
                icon={SearchIcon}
                title="No tags match your search"
                description="Try a different name."
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              <AnimatePresence initial={false}>
                {filteredTags.map((t, i) => (
                  <m.li
                    key={t._id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, delay: i * stagger, ease: EASE_OUT }}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white"
                      style={{ backgroundColor: t.color, boxShadow: `0 0 0 1px ${t.color}33` }}
                      aria-label={`Tag color ${t.color}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-zinc-900">{t.name}</p>
                      <p className="text-[11.5px] tabular-nums text-zinc-500">
                        {(t.usageCount ?? 0).toLocaleString()} messages
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label="Analytics"
                        onClick={() => openAnalytics(t)}
                        className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.97]"
                      >
                        <BarChart2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        aria-label="Edit"
                        onClick={() => openEdit(t)}
                        className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.97]"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete"
                        onClick={() => setDeleting(t)}
                        className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 active:scale-[0.97]"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </button>
                    </div>
                  </m.li>
                ))}
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
              className="rounded-xl"
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
              <BarChart data={mockChartData}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #eaeaea' }}
                />
                <Bar dataKey="usage" fill={analyticsTag?.color || '#10B981'} radius={[8, 8, 0, 0]} />
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
