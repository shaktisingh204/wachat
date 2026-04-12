'use client';

/**
 * Wachat Message Tags — create and manage tags for messages.
 */

import * as React from 'react';
import { useState } from 'react';
import { LuTag, LuPlus, LuTrash2 } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

type TagItem = { id: string; name: string; color: string; count: number };

const COLORS = [
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Violet', value: '#8b5cf6' },
  { label: 'Pink', value: '#ec4899' },
];

const INITIAL_TAGS: TagItem[] = [
  { id: '1', name: 'Urgent', color: '#ef4444', count: 45 },
  { id: '2', name: 'VIP Customer', color: '#f59e0b', count: 23 },
  { id: '3', name: 'Follow Up', color: '#3b82f6', count: 67 },
  { id: '4', name: 'Resolved', color: '#22c55e', count: 134 },
  { id: '5', name: 'Billing', color: '#8b5cf6', count: 18 },
];

export default function MessageTagsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [tags, setTags] = useState<TagItem[]>(INITIAL_TAGS);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0].value);

  const handleAdd = () => {
    if (!name.trim()) return;
    const newTag: TagItem = { id: Date.now().toString(), name: name.trim(), color, count: 0 };
    setTags((prev) => [...prev, newTag]);
    setName('');
    toast({ title: 'Tag Created', description: `Tag "${newTag.name}" added.` });
  };

  const handleDelete = (id: string) => {
    setTags((prev) => prev.filter((t) => t.id !== id));
    toast({ title: 'Deleted', description: 'Tag removed.' });
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Message Tags' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Message Tags</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Create and manage tags to organize your conversations.</p>
      </div>

      <ClayCard padded={false} className="p-5">
        <h2 className="text-[15px] font-semibold text-clay-ink mb-3">Add New Tag</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-[12px] text-clay-ink-muted mb-1 block">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Tag name"
              className="w-full rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none" />
          </div>
          <div>
            <label className="text-[12px] text-clay-ink-muted mb-1 block">Color</label>
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button key={c.value} type="button" onClick={() => setColor(c.value)}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${color === c.value ? 'border-clay-ink scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c.value }} title={c.label} />
              ))}
            </div>
          </div>
          <ClayButton size="sm" onClick={handleAdd} disabled={!name.trim()}
            leading={<LuPlus className="h-3.5 w-3.5" />}>
            Add Tag
          </ClayButton>
        </div>
      </ClayCard>

      {tags.length > 0 ? (
        <ClayCard padded={false} className="divide-y divide-clay-border">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-4 px-5 py-3">
              <span className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
              <span className="flex-1 text-[14px] font-medium text-clay-ink">{tag.name}</span>
              <span className="text-[12px] text-clay-ink-muted tabular-nums">{tag.count} messages</span>
              <button onClick={() => handleDelete(tag.id)}
                className="p-1.5 rounded-md hover:bg-red-50 transition-colors text-red-500" title="Delete">
                <LuTrash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </ClayCard>
      ) : (
        <ClayCard className="p-12 text-center">
          <LuTag className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">No tags yet. Create one above.</p>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}
