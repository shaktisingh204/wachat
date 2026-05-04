'use client';

/**
 * Wachat Contact Groups — rebuilt on ZoruUI primitives (phase 2).
 *
 * Same data, same handlers. Visual primitives swapped to ZoruUI.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { Plus, Trash2, Users, Loader2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import {
  getContactGroups,
  saveContactGroup,
  deleteContactGroup,
} from '@/app/actions/wachat-features.actions';

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
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  ZoruTextarea,
} from '@/components/zoruui';

export default function ContactGroupsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [groups, setGroups] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getContactGroups(String(activeProject._id));
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
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
      toast({
        title: 'Error',
        description: res.error,
        variant: 'destructive',
      });
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
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Group deleted.' });
      load();
    });
  };

  const isLoadingInitial = isPending && groups.length === 0;

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
            <ZoruBreadcrumbLink href="/wachat/contacts">
              Contacts
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Groups</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Contact Groups
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            Organise contacts into groups for targeted broadcasts.
          </p>
        </div>
        <ZoruDialog open={createOpen} onOpenChange={setCreateOpen}>
          <ZoruDialogTrigger asChild>
            <ZoruButton size="sm">
              <Plus /> New Group
            </ZoruButton>
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
                <ZoruLabel htmlFor="group-name" required>
                  Name
                </ZoruLabel>
                <ZoruInput
                  id="group-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. VIP Customers"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <ZoruLabel htmlFor="group-description">Description</ZoruLabel>
                <ZoruTextarea
                  id="group-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <ZoruDialogFooter>
                <ZoruButton
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </ZoruButton>
                <ZoruButton type="submit" disabled={submitting || !name.trim()}>
                  {submitting ? <Loader2 className="animate-spin" /> : null}
                  Create group
                </ZoruButton>
              </ZoruDialogFooter>
            </form>
          </ZoruDialogContent>
        </ZoruDialog>
      </div>

      {isLoadingInitial ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-32" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <ZoruEmptyState
          icon={<Users />}
          title="No groups yet"
          description="Create your first group to start segmenting contacts."
          action={
            <ZoruButton size="sm" onClick={() => setCreateOpen(true)}>
              <Plus /> Create group
            </ZoruButton>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <ZoruCard
              key={g._id}
              className="flex flex-col gap-3 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink">
                    <Users className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] text-zoru-ink">
                      {g.name}
                    </div>
                    {g.description && (
                      <div className="mt-0.5 truncate text-[12px] text-zoru-ink-muted">
                        {g.description}
                      </div>
                    )}
                  </div>
                </div>
                <ZoruAlertDialog>
                  <ZoruAlertDialogTrigger asChild>
                    <ZoruButton
                      variant="ghost"
                      size="icon-sm"
                      className="text-zoru-ink-muted hover:text-zoru-danger"
                      aria-label="Delete group"
                    >
                      <Trash2 />
                    </ZoruButton>
                  </ZoruAlertDialogTrigger>
                  <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                      <ZoruAlertDialogTitle>
                        Delete group?
                      </ZoruAlertDialogTitle>
                      <ZoruAlertDialogDescription>
                        This will remove the group "{g.name}". Contacts will
                        not be deleted.
                      </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                      <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                      <ZoruAlertDialogAction
                        destructive
                        onClick={() => handleDelete(g._id)}
                      >
                        Delete
                      </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                  </ZoruAlertDialogContent>
                </ZoruAlertDialog>
              </div>
              <div className="flex items-center justify-between border-t border-zoru-line pt-3 text-[12px] text-zoru-ink-muted">
                <ZoruBadge variant="secondary">
                  {g.memberCount ?? 0} members
                </ZoruBadge>
                <span>
                  {g.createdAt
                    ? new Date(g.createdAt).toLocaleDateString()
                    : '—'}
                </span>
              </div>
            </ZoruCard>
          ))}
        </div>
      )}
      <div className="h-6" />
    </div>
  );
}
