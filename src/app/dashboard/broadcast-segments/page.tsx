'use client';

/**
 * Wachat Broadcast Segments — create audience segments for broadcasts,
 * built on Clay primitives.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback, useActionState } from 'react';
import { LuUsers, LuLoader, LuTrash2, LuPlus } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  getBroadcastSegments,
  saveBroadcastSegment,
  deleteBroadcastSegment,
} from '@/app/actions/wachat-features.actions';

export default function BroadcastSegmentsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [segments, setSegments] = useState<any[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lastActive, setLastActive] = useState('all');

  const [formState, formAction, isPending] = useActionState(saveBroadcastSegment, null);

  const fetchSegments = useCallback(
    (pid: string) => {
      startLoading(async () => {
        const res = await getBroadcastSegments(pid);
        if (res.error) {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
          setSegments(res.segments || []);
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (projectId) fetchSegments(projectId);
  }, [projectId, fetchSegments]);

  useEffect(() => {
    if (formState?.message) {
      toast({ title: 'Success', description: formState.message });
      if (projectId) fetchSegments(projectId);
    }
    if (formState?.error) {
      toast({ title: 'Error', description: formState.error, variant: 'destructive' });
    }
  }, [formState, toast, projectId, fetchSegments]);

  const handleDelete = async (segmentId: string) => {
    setDeletingId(segmentId);
    const res = await deleteBroadcastSegment(segmentId);
    setDeletingId(null);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    } else {
      setSegments((prev) => prev.filter((s) => s._id !== segmentId));
      toast({ title: 'Deleted', description: 'Segment removed.' });
    }
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Broadcast Segments' },
        ]}
      />

      <div className="min-w-0">
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
          Broadcast Segments
        </h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">
          Create audience segments to target specific groups in your broadcast campaigns.
        </p>
      </div>

      {/* Create form */}
      <ClayCard padded={false} className="p-6">
        <h2 className="text-[16px] font-semibold text-clay-ink mb-4">Create a segment</h2>
        <form action={formAction} className="flex flex-col gap-4 max-w-lg">
          <input type="hidden" name="projectId" value={projectId || ''} />
          <input type="hidden" name="filterLastActive" value={lastActive} />
          <Input name="name" placeholder="Segment name" required />
          <Input name="filterTags" placeholder="Filter tags (comma-separated)" />
          <Select value={lastActive} onValueChange={setLastActive}>
            <SelectTrigger>
              <SelectValue placeholder="Last active" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Input name="filterCity" placeholder="City (optional)" />
          <div>
            <ClayButton
              type="submit"
              variant="obsidian"
              size="md"
              disabled={isPending || !projectId}
              leading={<LuPlus className="h-3.5 w-3.5" strokeWidth={2.5} />}
            >
              {isPending ? 'Creating...' : 'Create Segment'}
            </ClayButton>
          </div>
        </form>
      </ClayCard>

      {/* Segments grid */}
      <div>
        <h2 className="text-[22px] font-semibold tracking-tight text-clay-ink leading-none">
          Your Segments ({segments.length})
        </h2>
        <p className="mt-1.5 text-[12.5px] text-clay-ink-muted">
          Manage saved audience segments for broadcast targeting.
        </p>
      </div>

      {isLoading && segments.length === 0 ? (
        <div className="flex h-20 items-center justify-center">
          <LuLoader className="h-5 w-5 animate-spin text-clay-ink-muted" strokeWidth={1.75} />
        </div>
      ) : segments.length === 0 ? (
        <ClayCard padded={false} className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-clay-bg-2 text-clay-ink-muted">
            <LuUsers className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="mt-4 text-[15px] font-semibold text-clay-ink">No segments yet</div>
          <div className="mt-1.5 text-[12.5px] text-clay-ink-muted">Create your first segment above.</div>
        </ClayCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {segments.map((seg) => {
            const filters = seg.filters || {};
            return (
              <ClayCard key={seg._id} padded={false} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-semibold text-clay-ink">{seg.name}</h3>
                  <button
                    type="button"
                    onClick={() => handleDelete(seg._id)}
                    disabled={deletingId === seg._id}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-clay-red hover:bg-clay-red-soft transition-colors shrink-0"
                    aria-label={`Delete ${seg.name}`}
                  >
                    <LuTrash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(filters.tags || []).map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-[11px]">{tag}</Badge>
                  ))}
                  {filters.lastActive && (
                    <Badge variant="outline" className="text-[11px]">Active: {filters.lastActive}</Badge>
                  )}
                  {filters.city && (
                    <Badge variant="outline" className="text-[11px]">City: {filters.city}</Badge>
                  )}
                  {!filters.tags?.length && !filters.lastActive && !filters.city && (
                    <span className="text-[11.5px] text-clay-ink-muted">No filters</span>
                  )}
                </div>
                <p className="mt-3 text-[11px] text-clay-ink-muted">
                  Created {new Date(seg.createdAt).toLocaleDateString()}
                </p>
              </ClayCard>
            );
          })}
        </div>
      )}

      <div className="h-6" />
    </div>
  );
}
