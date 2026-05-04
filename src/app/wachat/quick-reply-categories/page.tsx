'use client';

/**
 * Wachat Quick Reply Categories — organize quick replies into categories.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuTag, LuPlus } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import {
  getQuickReplyCategories,
  saveQuickReplyCategory,
} from '@/app/actions/wachat-features.actions';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';

export const dynamic = 'force-dynamic';

export default function QuickReplyCategoriesPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState<any[]>([]);
  const [name, setName] = useState('');

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getQuickReplyCategories(activeProjectId);
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else setCategories(res.categories ?? []);
    });
  }, [activeProjectId, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = () => {
    if (!activeProjectId || !name.trim()) return;
    startTransition(async () => {
      const res = await saveQuickReplyCategory(activeProjectId, name.trim());
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else {
        toast({ title: 'Saved', description: res.message ?? 'Category created.' });
        setName('');
        fetchData();
      }
    });
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Quick Reply Categories' },
        ]}
      />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
          Quick Reply Categories
        </h1>
        <p className="mt-1.5 max-w-[720px] text-[13px] text-muted-foreground">
          Organize your quick replies into categories for faster access during conversations.
        </p>
      </div>

      {/* Add form */}
      <ClayCard className="p-5">
        <h3 className="text-sm font-medium text-foreground mb-3">Add Category</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Category name"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
          />
          <ClayButton size="sm" onClick={handleSave} disabled={isPending || !name.trim()}>
            <LuPlus className="mr-1.5 h-3.5 w-3.5" /> Save
          </ClayButton>
        </div>
      </ClayCard>

      {/* Categories list */}
      {categories.length > 0 ? (
        <ClayCard className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            {categories.length} {categories.length === 1 ? 'category' : 'categories'}
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <ClayBadge key={c._id}>{c.name}</ClayBadge>
            ))}
          </div>
        </ClayCard>
      ) : (
        !isPending && (
          <ClayCard className="p-12 text-center">
            <LuTag className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No categories yet. Create one above.</p>
          </ClayCard>
        )
      )}
    </div>
  );
}
