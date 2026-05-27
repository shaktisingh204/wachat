'use client';

import { fmtDate } from '@/lib/utils';
import { useEffect, useState, useTransition, useCallback, useActionState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { Loader2, Pencil, Plus, Trash2, Users, Layers } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getBroadcastSegments,
  saveBroadcastSegment,
  deleteBroadcastSegment,
} from '@/app/actions/wachat-features.actions';

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
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetFooter,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSheetTrigger,
} from '@/components/zoruui';

import {
  WaPage,
  PageHeader,
  Section,
  WaButton,
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

/**
 * Wachat Broadcast Segments - saved audience segments.
 * Same actions; wachat-ui chrome.
 */

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
  initial?: Partial<{ name: string; filterTags: string; filterCity: string; filterLastActive: string }>;
  projectId: string | undefined;
  formAction: (formData: FormData) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [lastActive, setLastActive] = useState(initial?.filterLastActive || 'all');

  return (
    <Sheet open={open} onOpenChange={setOpen}>
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
            <Label htmlFor="seg-name">Segment name</Label>
            <Input id="seg-name" name="name" defaultValue={initial?.name} placeholder="High-value customers" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="seg-tags">Filter tags</Label>
            <Input id="seg-tags" name="filterTags" defaultValue={initial?.filterTags} placeholder="Comma-separated, e.g. vip, returning" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Last active</Label>
            <Select value={lastActive} onValueChange={setLastActive}>
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Last active" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="7d">Last 7 days</ZoruSelectItem>
                <ZoruSelectItem value="30d">Last 30 days</ZoruSelectItem>
                <ZoruSelectItem value="90d">Last 90 days</ZoruSelectItem>
                <ZoruSelectItem value="all">All time</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="seg-city">City</Label>
            <Input id="seg-city" name="filterCity" defaultValue={initial?.filterCity} placeholder="Optional" />
          </div>
          <ZoruSheetFooter>
            <WaButton variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </WaButton>
            <WaButton type="submit" disabled={isPending || !projectId}>
              {isPending ? 'Saving' : 'Save segment'}
            </WaButton>
          </ZoruSheetFooter>
        </form>
      </ZoruSheetContent>
    </Sheet>
  );
}

export default function BroadcastSegmentsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const reduce = useReducedMotion();

  const [segments, setSegments] = useState<any[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    <WaPage>
      <PageHeader
        title="Broadcast segments"
        description="Saved audience slices you can pick when launching a campaign."
        kicker="Wachat / segments"
        eyebrowIcon={Layers}
        backHref="/wachat"
        actions={
          <SegmentSheet
            trigger={<WaButton leftIcon={Plus}>Create segment</WaButton>}
            title="Create a segment"
            description="Define audience criteria for future broadcasts."
            projectId={projectId}
            formAction={formAction}
            isPending={isPending}
          />
        }
      />

      <Section
        title={`Your segments (${segments.length})`}
        description="Manage saved audience segments for broadcast targeting."
        padded={false}
      >
        <div className="p-5">
          {isLoading && segments.length === 0 ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          ) : segments.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No segments yet"
              description="Create your first segment to target subsets of your contacts."
              action={
                <SegmentSheet
                  trigger={<WaButton leftIcon={Plus}>Create segment</WaButton>}
                  title="Create a segment"
                  description="Define audience criteria for future broadcasts."
                  projectId={projectId}
                  formAction={formAction}
                  isPending={isPending}
                />
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {segments.map((seg, i) => {
                const filters = seg.filters || {};
                return (
                  <m.article
                    key={seg._id}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.03 + i * 0.035, ease: EASE_OUT }}
                    className="rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:bg-zinc-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate text-[13.5px] font-semibold text-zinc-900">{seg.name}</h3>
                      <div className="flex items-center gap-1">
                        <SegmentSheet
                          trigger={
                            <button
                              type="button"
                              aria-label={`Edit ${seg.name}`}
                              className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.97]"
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
                            </button>
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
                            <button
                              type="button"
                              aria-label={`Delete ${seg.name}`}
                              disabled={deletingId === seg._id}
                              className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-rose-50 hover:text-rose-600 active:scale-[0.97] disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                            </button>
                          </ZoruAlertDialogTrigger>
                          <ZoruAlertDialogContent>
                            <ZoruAlertDialogHeader>
                              <ZoruAlertDialogTitle>Delete segment?</ZoruAlertDialogTitle>
                              <ZoruAlertDialogDescription>
                                &ldquo;{seg.name}&rdquo; will be removed. Broadcasts already using it will keep their audience.
                              </ZoruAlertDialogDescription>
                            </ZoruAlertDialogHeader>
                            <ZoruAlertDialogFooter>
                              <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                              <ZoruAlertDialogAction onClick={() => handleDelete(seg._id)}>
                                Delete
                              </ZoruAlertDialogAction>
                            </ZoruAlertDialogFooter>
                          </ZoruAlertDialogContent>
                        </ZoruAlertDialog>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(filters.tags || []).map((tag: string) => (
                        <span key={tag} className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                          {tag}
                        </span>
                      ))}
                      {filters.lastActive && filters.lastActive !== 'all' && (
                        <span className="inline-flex items-center rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                          Active: {filters.lastActive}
                        </span>
                      )}
                      {filters.city && (
                        <span className="inline-flex items-center rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                          City: {filters.city}
                        </span>
                      )}
                      {!filters.tags?.length && !filters.lastActive && !filters.city && (
                        <span className="text-[11.5px] text-zinc-500">No filters</span>
                      )}
                    </div>
                    <p className="mt-3 text-[11px] text-zinc-500">Created {fmtDate(seg.createdAt)}</p>
                  </m.article>
                );
              })}
            </div>
          )}
        </div>
      </Section>
    </WaPage>
  );
}
