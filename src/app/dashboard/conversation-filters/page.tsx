'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuFilter, LuPlus, LuTrash2, LuPlay, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';
import { getConversationFilters, saveConversationFilter, deleteConversationFilter } from '@/app/actions/wachat-features.actions';

export default function ConversationFiltersPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();
  const [filters, setFilters] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', status: '', tag: '', agent: '', dateFrom: '', dateTo: '' });
  const [isLoading, startTransition] = useTransition();
  const [isMutating, startMutateTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getConversationFilters(projectId);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      setFilters(res.filters ?? []);
    });
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = () => {
    if (!form.name.trim() || !projectId) return;
    const conditions: Record<string, any> = {};
    if (form.status) conditions.status = form.status;
    if (form.tag) conditions.tag = form.tag;
    if (form.agent) conditions.agent = form.agent;
    if (form.dateFrom) conditions.dateFrom = form.dateFrom;
    if (form.dateTo) conditions.dateTo = form.dateTo;
    startMutateTransition(async () => {
      const res = await saveConversationFilter(projectId, form.name.trim(), conditions);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      toast({ title: 'Filter Created', description: res.message });
      setForm({ name: '', status: '', tag: '', agent: '', dateFrom: '', dateTo: '' });
      setShowForm(false);
      fetchData();
    });
  };

  const handleDelete = (filterId: string) => {
    startMutateTransition(async () => {
      const res = await deleteConversationFilter(filterId);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      toast({ title: 'Deleted', description: 'Filter removed.' });
      fetchData();
    });
  };

  const inputCls = 'rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none';

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <LuLoader className="h-6 w-6 animate-spin text-clay-ink-muted" />
      </div>
    );
  }

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Conversation Filters' },
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Conversation Filters</h1>
          <p className="mt-1.5 text-[13px] text-clay-ink-muted">Create saved filter presets to quickly find conversations.</p>
        </div>
        <ClayButton size="sm" onClick={() => setShowForm(!showForm)}>
          <LuPlus className="mr-1.5 h-3.5 w-3.5" /> New Filter
        </ClayButton>
      </div>

      {showForm && (
        <ClayCard padded={false} className="p-5">
          <h2 className="text-[15px] font-semibold text-clay-ink mb-4">Create Filter</h2>
          <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
            <input className={inputCls} placeholder="Filter name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="">Any status</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <input className={inputCls} placeholder="Tag" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} />
            <select className={inputCls} value={form.agent} onChange={(e) => setForm({ ...form, agent: e.target.value })}>
              <option value="">Any agent</option>
              <option value="unassigned">Unassigned</option>
              <option value="me">Assigned to me</option>
            </select>
            <input type="date" className={inputCls} value={form.dateFrom} onChange={(e) => setForm({ ...form, dateFrom: e.target.value })} />
            <input type="date" className={inputCls} value={form.dateTo} onChange={(e) => setForm({ ...form, dateTo: e.target.value })} />
          </div>
          <div className="mt-4">
            <ClayButton size="sm" variant="obsidian" onClick={handleCreate} disabled={!form.name.trim() || isMutating}>
              Save Filter
            </ClayButton>
          </div>
        </ClayCard>
      )}

      {filters.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filters.map((f) => {
            const c = f.conditions || {};
            return (
              <ClayCard key={f._id} padded={false} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-semibold text-clay-ink">{f.name}</h3>
                  <button onClick={() => handleDelete(f._id)} disabled={isMutating}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-50 transition-colors shrink-0" aria-label="Delete">
                    <LuTrash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.status && <ClayBadge tone="neutral">{c.status}</ClayBadge>}
                  {c.tag && <ClayBadge tone="blue">{c.tag}</ClayBadge>}
                  {c.agent && <ClayBadge tone="neutral">{c.agent}</ClayBadge>}
                  {(c.dateFrom || c.dateTo) && <ClayBadge tone="neutral">{c.dateFrom || '...'} - {c.dateTo || '...'}</ClayBadge>}
                </div>
                <div className="mt-3">
                  <ClayButton size="sm" variant="ghost" onClick={() => toast({ title: 'Applied', description: `Filter "${f.name}" applied.` })}>
                    <LuPlay className="mr-1 h-3.5 w-3.5" /> Apply
                  </ClayButton>
                </div>
              </ClayCard>
            );
          })}
        </div>
      ) : (
        <ClayCard className="p-12 text-center">
          <LuFilter className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">No saved filters yet.</p>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}
