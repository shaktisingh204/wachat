'use client';

import { fmtDate } from '@/lib/utils';

import {
  useZoruToast,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Input,
  Label,
  Textarea,
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
  Trash2,
  Users,
  Loader2,
  Layers,
  Megaphone,
  Search as SearchIcon,
  CalendarClock,
} from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import {
  getContactGroups,
  saveContactGroup,
  deleteContactGroup,
} from '@/app/actions/wachat-features.actions';

import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  EmptyState,
  StatusPill,
  Section,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

import * as React from 'react';

const WA_GREEN = '#25D366';
const GROUP_COLORS = ['#25D366', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#0EA5E9', '#10B981'];

function colorForGroup(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0x7fffffff;
  return GROUP_COLORS[hash % GROUP_COLORS.length];
}

function monogram(name: string | undefined | null): string {
  const s = (name || '').trim();
  if (!s) return '??';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

type SizeFilter = 'all' | 'empty' | 'small' | 'medium' | 'large';

export default function ContactGroupsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [groups, setGroups] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>('all');
  const reduceMotion = useReducedMotion();

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getContactGroups(String(activeProject._id));
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setGroups(res.groups ?? []);
    });
  }, [activeProject?._id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject?._id || !name.trim()) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.set('projectId', String(activeProject._id));
    fd.set('name', name.trim());
    fd.set('description', description.trim());
    const res = await saveContactGroup(null, fd);
    setSubmitting(false);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
      return;
    }
    toast({ title: res.message || 'Group created' });
    setName('');
    setDescription('');
    setCreateOpen(false);
    load();
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteContactGroup(id);
      if (!res.success) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Group deleted.' });
      load();
    });
  };

  const stats = useMemo(() => {
    const totalMembers = groups.reduce((sum, g) => sum + (g.memberCount ?? 0), 0);
    const usedInBroadcasts = groups.filter((g) => (g.broadcastCount ?? 0) > 0).length;
    return {
      total: groups.length,
      totalMembers,
      usedInBroadcasts,
      avg: groups.length > 0 ? Math.round(totalMembers / groups.length) : 0,
    };
  }, [groups]);

  const filteredGroups = useMemo(() => {
    let rows = groups.slice();
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((g) =>
        (g.name || '').toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q),
      );
    }
    if (sizeFilter !== 'all') {
      rows = rows.filter((g) => {
        const n = g.memberCount ?? 0;
        if (sizeFilter === 'empty') return n === 0;
        if (sizeFilter === 'small') return n > 0 && n < 50;
        if (sizeFilter === 'medium') return n >= 50 && n < 500;
        if (sizeFilter === 'large') return n >= 500;
        return true;
      });
    }
    return rows;
  }, [groups, search, sizeFilter]);

  const isLoadingInitial = isPending && groups.length === 0;
  const stagger = reduceMotion ? 0 : 0.03;

  return (
    <WaPage>
      <PageHeader
        title="Contact groups"
        description="Organise contacts into groups for targeted broadcasts."
        kicker="Wachat · contacts"
        backHref="/wachat/contacts"
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <ZoruDialogTrigger asChild>
              <WaButton leftIcon={Plus}>New group</WaButton>
            </ZoruDialogTrigger>
            <ZoruDialogContent>
              <ZoruDialogHeader>
                <ZoruDialogTitle>Create contact group</ZoruDialogTitle>
                <ZoruDialogDescription>
                  Group contacts together for targeted broadcasts.
                </ZoruDialogDescription>
              </ZoruDialogHeader>
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="group-name" required>Name</Label>
                  <Input
                    id="group-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. VIP customers"
                    required
                    className="rounded-lg"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="group-description">Description</Label>
                  <Textarea
                    id="group-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
                <ZoruDialogFooter>
                  <WaButton type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </WaButton>
                  <WaButton type="submit" disabled={submitting || !name.trim()}>
                    {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Create group
                  </WaButton>
                </ZoruDialogFooter>
              </form>
            </ZoruDialogContent>
          </Dialog>
        }
      />

      {/* KPI strip */}
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Total groups" value={stats.total.toLocaleString()} icon={Layers} delay={0} />
        <MetricTile label="Contacts in groups" value={stats.totalMembers.toLocaleString()} icon={Users} delay={0.05} />
        <MetricTile label="Avg members" value={stats.avg.toLocaleString()} delay={0.1} />
        <MetricTile label="Used in broadcasts" value={stats.usedInBroadcasts.toLocaleString()} icon={Megaphone} delay={0.15} />
      </section>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 focus-within:border-zinc-400">
          <SearchIcon className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups..."
            className="h-6 border-0 bg-transparent px-0 text-[12.5px] shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-0.5">
          {(['all', 'empty', 'small', 'medium', 'large'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSizeFilter(s)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors',
                sizeFilter === s
                  ? 'text-white'
                  : 'text-zinc-600 hover:text-zinc-900',
              )}
              style={sizeFilter === s ? { backgroundColor: WA_GREEN } : undefined}
            >
              {s === 'all' ? 'All sizes' : s === 'small' ? '<50' : s === 'medium' ? '50-499' : s === 'large' ? '500+' : 'Empty'}
            </button>
          ))}
        </div>
      </div>

      {isLoadingInitial ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl border border-zinc-200 bg-white" />
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search || sizeFilter !== 'all' ? 'No matching groups' : 'No groups yet'}
          description={search || sizeFilter !== 'all' ? 'Try a different filter.' : 'Create your first group to start segmenting contacts.'}
          action={
            !search && sizeFilter === 'all' ? (
              <WaButton onClick={() => setCreateOpen(true)} leftIcon={Plus}>
                Create group
              </WaButton>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((g, i) => {
            const color = (g.color as string) || colorForGroup(g.name || '');
            const memberCount = g.memberCount ?? 0;
            const recentMembers: any[] = Array.isArray(g.recentMembers) ? g.recentMembers : [];
            const broadcastCount = g.broadcastCount ?? 0;
            return (
              <m.article
                key={g._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * stagger, ease: EASE_OUT }}
                className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[1px]"
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 14px 32px -20px ${color}55`; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}
              >
                {/* color label hairline */}
                <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: color }} />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {monogram(g.name)}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-[13.5px] font-semibold tracking-tight text-zinc-950">{g.name}</h3>
                      {g.description && (
                        <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-zinc-500">{g.description}</p>
                      )}
                    </div>
                  </div>
                  <ZoruAlertDialog>
                    <ZoruAlertDialogTrigger asChild>
                      <button
                        type="button"
                        aria-label="Delete group"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 active:scale-[0.97]"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </button>
                    </ZoruAlertDialogTrigger>
                    <ZoruAlertDialogContent>
                      <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete group?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                          This will remove the group &ldquo;{g.name}&rdquo;. Contacts will not be deleted.
                        </ZoruAlertDialogDescription>
                      </ZoruAlertDialogHeader>
                      <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction destructive onClick={() => handleDelete(g._id)}>
                          Delete
                        </ZoruAlertDialogAction>
                      </ZoruAlertDialogFooter>
                    </ZoruAlertDialogContent>
                  </ZoruAlertDialog>
                </div>

                {/* Member preview row */}
                {recentMembers.length > 0 && (
                  <div className="mt-3 flex -space-x-1.5">
                    {recentMembers.slice(0, 5).map((m: any, idx: number) => (
                      <span
                        key={(m._id || m.waId || idx) + ''}
                        className="grid h-6 w-6 place-items-center rounded-full border-2 border-white text-[9px] font-semibold text-white shadow-sm"
                        style={{ backgroundColor: colorForGroup(m.name || m.waId || String(idx)) }}
                        title={m.name || m.waId}
                      >
                        {monogram(m.name || m.waId)}
                      </span>
                    ))}
                    {recentMembers.length > 5 && (
                      <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-zinc-100 text-[9px] font-bold text-zinc-600">
                        +{recentMembers.length - 5}
                      </span>
                    )}
                  </div>
                )}

                {/* Stats row */}
                <dl className="mt-3 grid grid-cols-3 gap-1 border-t border-zinc-100 pt-3">
                  <div>
                    <dt className="text-[9.5px] font-semibold uppercase tracking-wider text-zinc-500">Members</dt>
                    <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-zinc-950">{memberCount.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-[9.5px] font-semibold uppercase tracking-wider text-zinc-500">Broadcasts</dt>
                    <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-zinc-950">{broadcastCount.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-[9.5px] font-semibold uppercase tracking-wider text-zinc-500">Created</dt>
                    <dd className="mt-0.5 truncate text-[11px] tabular-nums text-zinc-600">
                      {g.createdAt ? fmtDate(g.createdAt) : '-'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex items-center justify-between">
                  <StatusPill tone={memberCount > 0 ? 'live' : 'draft'}>
                    {memberCount > 0 ? 'Active' : 'Empty'}
                  </StatusPill>
                  {g.updatedAt && (
                    <span className="inline-flex items-center gap-1 text-[10px] tabular-nums text-zinc-400">
                      <CalendarClock className="h-2.5 w-2.5" strokeWidth={2.5} />
                      Updated {fmtDate(g.updatedAt)}
                    </span>
                  )}
                </div>
              </m.article>
            );
          })}
        </div>
      )}
    </WaPage>
  );
}
