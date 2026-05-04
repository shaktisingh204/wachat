'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuTag, LuPlus, LuTrash2, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import { getMessageTags, saveMessageTag, deleteMessageTag } from '@/app/actions/wachat-features.actions';

const COLORS = [
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Violet', value: '#8b5cf6' },
  { label: 'Pink', value: '#ec4899' },
];

export default function MessageTagsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();
  const [tags, setTags] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0].value);
  const [isLoading, startTransition] = useTransition();
  const [isMutating, startMutateTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getMessageTags(projectId);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      setTags(res.tags ?? []);
    });
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = () => {
    if (!name.trim() || !projectId) return;
    startMutateTransition(async () => {
      const res = await saveMessageTag(projectId, name.trim(), color);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      toast({ title: 'Tag Created', description: res.message });
      setName('');
      fetchData();
    });
  };

  const handleDelete = (tagId: string, tagName: string) => {
    if (!window.confirm(`Delete tag "${tagName}"? This cannot be undone.`)) return;
    startMutateTransition(async () => {
      const res = await deleteMessageTag(tagId);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      toast({ title: 'Deleted', description: 'Tag removed.' });
      fetchData();
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <LuLoader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/dashboard' },
        { label: activeProject?.name || 'Project', href: '/wachat' },
        { label: 'Message Tags' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">Message Tags</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Create and manage tags to organize your conversations.</p>
      </div>

      <ClayCard padded={false} className="p-5">
        <h2 className="text-[15px] font-semibold text-foreground mb-3">Add New Tag</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-[12px] text-muted-foreground mb-1 block">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()} placeholder="Tag name"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none" />
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground mb-1 block">Color</label>
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button key={c.value} type="button" onClick={() => setColor(c.value)}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${color === c.value ? 'border-foreground scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c.value }} title={c.label} />
              ))}
            </div>
          </div>
          <ClayButton size="sm" onClick={handleAdd} disabled={!name.trim() || isMutating}
            leading={<LuPlus className="h-3.5 w-3.5" />}>
            Add Tag
          </ClayButton>
        </div>
      </ClayCard>

      {tags.length > 0 ? (
        <ClayCard padded={false} className="divide-y divide-border">
          {tags.map((tag) => (
            <div key={tag._id} className="flex items-center gap-4 px-5 py-3">
              <span className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
              <span className="flex-1 text-[14px] font-medium text-foreground">{tag.name}</span>
              <span className="text-[12px] text-muted-foreground tabular-nums">{tag.usageCount ?? 0} messages</span>
              <button onClick={() => handleDelete(tag._id, tag.name)} disabled={isMutating}
                className="p-1.5 rounded-md hover:bg-red-50 transition-colors text-red-500" title="Delete">
                <LuTrash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </ClayCard>
      ) : (
        <ClayCard className="p-12 text-center">
          <LuTag className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">No tags yet. Create one above.</p>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}
