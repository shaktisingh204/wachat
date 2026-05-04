'use client';

/**
 * Wachat Broadcast Segments — saved audience segments, ZoruUI rebuild.
 * Save / edit segments via ZoruSheet; delete via ZoruAlertDialog.
 */

import * as React from 'react';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useActionState,
} from 'react';
import { Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useZoruToast } from '@/components/zoruui';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetFooter,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSheetTrigger,
} from '@/components/zoruui';

import {
  getBroadcastSegments,
  saveBroadcastSegment,
  deleteBroadcastSegment,
} from '@/app/actions/wachat-features.actions';

/* ── save / edit segment sheet ──────────────────────────────────── */

function SegmentSheet({
  trigger,
  title,
  description,
  initial,
  projectId,
  formAction,
  isPending,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  initial?: Partial<{
    name: string;
    filterTags: string;
    filterCity: string;
    filterLastActive: string;
  }>;
  projectId: string | undefined;
  formAction: (formData: FormData) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [lastActive, setLastActive] = useState(
    initial?.filterLastActive || 'all',
  );

  return (
    <ZoruSheet open={open} onOpenChange={setOpen}>
      <ZoruSheetTrigger asChild>{trigger}</ZoruSheetTrigger>
      <ZoruSheetContent side="right" className="sm:max-w-md">
        <ZoruSheetHeader>
          <ZoruSheetTitle>{title}</ZoruSheetTitle>
          <ZoruSheetDescription>{description}</ZoruSheetDescription>
        </ZoruSheetHeader>
        <form
          action={(fd) => {
            formAction(fd);
            setOpen(false);
          }}
          className="mt-5 flex flex-col gap-4"
        >
          <input type="hidden" name="projectId" value={projectId || ''} />
          <input type="hidden" name="filterLastActive" value={lastActive} />
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="seg-name">Segment name</ZoruLabel>
            <ZoruInput
              id="seg-name"
              name="name"
              defaultValue={initial?.name}
              placeholder="High-value customers"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="seg-tags">Filter tags</ZoruLabel>
            <ZoruInput
              id="seg-tags"
              name="filterTags"
              defaultValue={initial?.filterTags}
              placeholder="Comma-separated, e.g. vip, returning"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel>Last active</ZoruLabel>
            <ZoruSelect value={lastActive} onValueChange={setLastActive}>
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Last active" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="7d">Last 7 days</ZoruSelectItem>
                <ZoruSelectItem value="30d">Last 30 days</ZoruSelectItem>
                <ZoruSelectItem value="90d">Last 90 days</ZoruSelectItem>
                <ZoruSelectItem value="all">All time</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="seg-city">City</ZoruLabel>
            <ZoruInput
              id="seg-city"
              name="filterCity"
              defaultValue={initial?.filterCity}
              placeholder="Optional"
            />
          </div>
          <ZoruSheetFooter>
            <ZoruButton
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </ZoruButton>
            <ZoruButton type="submit" disabled={isPending || !projectId}>
              {isPending ? 'Saving…' : 'Save Segment'}
            </ZoruButton>
          </ZoruSheetFooter>
        </form>
      </ZoruSheetContent>
    </ZoruSheet>
  );
}

/* ── page ───────────────────────────────────────────────────────── */

export default function BroadcastSegmentsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [segments, setSegments] = useState<any[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formState, formAction, isPending] = useActionState(
    saveBroadcastSegment,
    null,
  );

  const fetchSegments = useCallback(
    (pid: string) => {
      startLoading(async () => {
        const res = await getBroadcastSegments(pid);
        if (res.error) {
          toast({
            title: 'Error',
            description: res.error,
            variant: 'destructive',
          });
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
      toast({
        title: 'Error',
        description: formState.error,
        variant: 'destructive',
      });
    }
  }, [formState, toast, projectId, fetchSegments]);

  const handleDelete = async (segmentId: string) => {
    setDeletingId(segmentId);
    const res = await deleteBroadcastSegment(segmentId);
    setDeletingId(null);
    if (res.error) {
      toast({
        title: 'Error',
        description: res.error,
        variant: 'destructive',
      });
    } else {
      setSegments((prev) => prev.filter((s) => s._id !== segmentId));
      toast({ title: 'Deleted', description: 'Segment removed.' });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Broadcast Segments</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Broadcast Segments
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            Create audience segments to target specific groups in your
            broadcast campaigns.
          </p>
        </div>
        <SegmentSheet
          trigger={
            <ZoruButton size="sm">
              <Plus className="h-3.5 w-3.5" /> Create segment
            </ZoruButton>
          }
          title="Create a segment"
          description="Define audience criteria for future broadcasts."
          projectId={projectId}
          formAction={formAction}
          isPending={isPending}
        />
      </div>

      {/* Segments grid */}
      <div>
        <h2 className="text-[18px] tracking-tight text-zoru-ink leading-none">
          Your Segments ({segments.length})
        </h2>
        <p className="mt-1.5 text-[12.5px] text-zoru-ink-muted">
          Manage saved audience segments for broadcast targeting.
        </p>
      </div>

      {isLoading && segments.length === 0 ? (
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
        </div>
      ) : segments.length === 0 ? (
        <ZoruEmptyState
          icon={<Users />}
          title="No segments yet"
          description="Create your first segment to target subsets of your contacts."
          action={
            <SegmentSheet
              trigger={
                <ZoruButton size="sm">
                  <Plus className="h-3.5 w-3.5" /> Create segment
                </ZoruButton>
              }
              title="Create a segment"
              description="Define audience criteria for future broadcasts."
              projectId={projectId}
              formAction={formAction}
              isPending={isPending}
            />
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {segments.map((seg) => {
            const filters = seg.filters || {};
            return (
              <ZoruCard key={seg._id} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm text-zoru-ink">{seg.name}</h3>
                  <div className="flex items-center gap-1">
                    <SegmentSheet
                      trigger={
                        <ZoruButton
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${seg.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </ZoruButton>
                      }
                      title="Edit segment"
                      description="Update audience criteria."
                      initial={{
                        name: seg.name,
                        filterTags: (filters.tags || []).join(', '),
                        filterCity: filters.city || '',
                        filterLastActive: filters.lastActive || 'all',
                      }}
                      projectId={projectId}
                      formAction={formAction}
                      isPending={isPending}
                    />
                    <ZoruAlertDialog>
                      <ZoruAlertDialogTrigger asChild>
                        <ZoruButton
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${seg.name}`}
                          disabled={deletingId === seg._id}
                          className="text-zoru-danger hover:bg-zoru-danger/10 hover:text-zoru-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </ZoruButton>
                      </ZoruAlertDialogTrigger>
                      <ZoruAlertDialogContent>
                        <ZoruAlertDialogHeader>
                          <ZoruAlertDialogTitle>
                            Delete segment?
                          </ZoruAlertDialogTitle>
                          <ZoruAlertDialogDescription>
                            &ldquo;{seg.name}&rdquo; will be removed. Broadcasts
                            already using it will keep their audience.
                          </ZoruAlertDialogDescription>
                        </ZoruAlertDialogHeader>
                        <ZoruAlertDialogFooter>
                          <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                          <ZoruAlertDialogAction
                            onClick={() => handleDelete(seg._id)}
                          >
                            Delete
                          </ZoruAlertDialogAction>
                        </ZoruAlertDialogFooter>
                      </ZoruAlertDialogContent>
                    </ZoruAlertDialog>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(filters.tags || []).map((tag: string) => (
                    <ZoruBadge key={tag} variant="secondary">
                      {tag}
                    </ZoruBadge>
                  ))}
                  {filters.lastActive && (
                    <ZoruBadge variant="outline">
                      Active: {filters.lastActive}
                    </ZoruBadge>
                  )}
                  {filters.city && (
                    <ZoruBadge variant="outline">City: {filters.city}</ZoruBadge>
                  )}
                  {!filters.tags?.length &&
                    !filters.lastActive &&
                    !filters.city && (
                      <span className="text-[11.5px] text-zoru-ink-muted">
                        No filters
                      </span>
                    )}
                </div>
                <p className="mt-3 text-[11px] text-zoru-ink-muted">
                  Created {new Date(seg.createdAt).toLocaleDateString()}
                </p>
              </ZoruCard>
            );
          })}
        </div>
      )}

      <div className="h-6" />
    </div>
  );
}
