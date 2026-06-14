'use client';
import { fmtDate } from "@/lib/utils";

import {
  useToast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  IconButton,
  Card,
  CardTitle,
  CardDescription,
  EmptyState,
  Field,
  Input,
  SelectField as Select,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Spinner,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useActionState,
  } from 'react';
import {
  Pencil,
  Plus,
  Trash2,
  Users } from 'lucide-react';

import { useProject } from '@/context/project-context';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { AiSegmentSuggester } from '@/components/wachat/broadcasts/ai-segment-suggester';

/**
 * Wachat Broadcast Segments — saved audience segments, 20ui rebuild.
 * Save / edit segments via Drawer; delete via AlertDialog.
 */

import * as React from 'react';

import {
  getBroadcastSegments,
  saveBroadcastSegment,
  deleteBroadcastSegment,
} from '@/app/actions/wachat-features.actions';

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

const LAST_ACTIVE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

/* ── save / edit segment drawer ─────────────────────────────────── */

function SegmentDrawer({
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
    <Drawer open={open} onOpenChange={setOpen} side="right">
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent side="right">
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <form
          action={(fd) => {
            formAction(fd);
            setOpen(false);
          }}
          className="mt-5 flex flex-col gap-4"
        >
          <input type="hidden" name="projectId" value={projectId || ''} />
          <input type="hidden" name="filterLastActive" value={lastActive} />
          <Field label="Segment name">
            <Input
              name="name"
              defaultValue={initial?.name}
              placeholder="High-value customers"
              required
            />
          </Field>
          <Field label="Filter tags">
            <Input
              name="filterTags"
              defaultValue={initial?.filterTags}
              placeholder="Comma-separated, e.g. vip, returning"
            />
          </Field>
          <Field label="Last active">
            <Select
              value={lastActive}
              onChange={(v) => setLastActive(v ?? 'all')}
              options={LAST_ACTIVE_OPTIONS}
              placeholder="Last active"
              aria-label="Last active"
            />
          </Field>
          <Field label="City">
            <Input
              name="filterCity"
              defaultValue={initial?.filterCity}
              placeholder="Optional"
            />
          </Field>
          <DrawerFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isPending || !projectId}
            >
              {isPending ? 'Saving…' : 'Save Segment'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

/* ── page ───────────────────────────────────────────────────────── */

export default function BroadcastSegmentsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
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
            tone: 'danger',
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
      toast({ title: 'Success', description: formState.message, tone: 'success' });
      if (projectId) fetchSegments(projectId);
    }
    if (formState?.error) {
      toast({
        title: 'Error',
        description: formState.error,
        tone: 'danger',
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
        tone: 'danger',
      });
    } else {
      setSegments((prev) => prev.filter((s) => s._id !== segmentId));
      toast({ title: 'Deleted', description: 'Segment removed.', tone: 'success' });
    }
  };

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Broadcast Segments' },
      ]}
      title="Broadcast Segments"
      description="Create audience segments to target specific groups in your broadcast campaigns."
      actions={
        <SegmentDrawer
          trigger={
            <Button size="sm" variant="primary" iconLeft={Plus}>
              Create segment
            </Button>
          }
          title="Create a segment"
          description="Define audience criteria for future broadcasts."
          projectId={projectId}
          formAction={formAction}
          isPending={isPending}
        />
      }
    >
      <div className="flex flex-col gap-6">
        <AiSegmentSuggester />
        {/* Segments grid */}
        <div>
          <CardTitle className="text-[18px] tracking-tight leading-none">
            Your Segments ({segments.length})
          </CardTitle>
          <CardDescription className="mt-1.5 text-[12.5px]">
            Manage saved audience segments for broadcast targeting.
          </CardDescription>
        </div>

        {isLoading && segments.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <Spinner label="Loading segments" />
          </div>
        ) : segments.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No segments yet"
            description="Create your first segment to target subsets of your contacts."
            action={
              <SegmentDrawer
                trigger={
                  <Button size="sm" variant="primary" iconLeft={Plus}>
                    Create segment
                  </Button>
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
                <Card key={seg._id} padding="lg">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm">
                      {seg.name}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <SegmentDrawer
                        trigger={
                          <IconButton
                            label={`Edit ${seg.name}`}
                            icon={Pencil}
                            variant="ghost"
                            size="sm"
                          />
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
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <IconButton
                            label={`Delete ${seg.name}`}
                            icon={Trash2}
                            variant="ghost"
                            size="sm"
                            disabled={deletingId === seg._id}
                          />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete segment?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              &ldquo;{seg.name}&rdquo; will be removed. Broadcasts
                              already using it will keep their audience.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(seg._id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(filters.tags || []).map((tag: string) => (
                      <Badge key={tag} tone="neutral" kind="soft">
                        {tag}
                      </Badge>
                    ))}
                    {filters.lastActive && (
                      <Badge tone="neutral" kind="outline">
                        Active: {filters.lastActive}
                      </Badge>
                    )}
                    {filters.city && (
                      <Badge tone="neutral" kind="outline">
                        City: {filters.city}
                      </Badge>
                    )}
                    {!filters.tags?.length &&
                      !filters.lastActive &&
                      !filters.city && (
                        <span className="text-[11.5px] [color:var(--st-text-tertiary)]">
                          No filters
                        </span>
                      )}
                  </div>
                  <p className="mt-3 text-[11px] [color:var(--st-text-tertiary)]">
                    Created {fmtDate(seg.createdAt)}
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </WachatPage>
  );
}
