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
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
} from 'react';
import { Plus, Trash2, Users, Loader2 } from 'lucide-react';
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
  EmptyState,
  StatusPill,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

import * as React from 'react';

export default function ContactGroupsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [groups, setGroups] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
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

  const isLoadingInitial = isPending && groups.length === 0;
  const stagger = reduceMotion ? 0 : 0.04;

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
                    className="rounded-xl"
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

      {isLoadingInitial ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No groups yet"
          description="Create your first group to start segmenting contacts."
          action={
            <WaButton onClick={() => setCreateOpen(true)} leftIcon={Plus}>
              Create group
            </WaButton>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g, i) => (
            <m.article
              key={g._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * stagger, ease: EASE_OUT }}
              className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[2px]"
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 18px 40px -22px var(--mt-accent-glow)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white"
                  style={{ backgroundImage: 'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 60%, white))' }}
                >
                  <Users className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                </span>
                <ZoruAlertDialog>
                  <ZoruAlertDialogTrigger asChild>
                    <button
                      type="button"
                      aria-label="Delete group"
                      className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 active:scale-[0.97]"
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
              <h3 className="mt-4 truncate text-[15px] font-semibold tracking-tight text-zinc-950">{g.name}</h3>
              {g.description && (
                <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-zinc-600">{g.description}</p>
              )}
              <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-3">
                <StatusPill tone="live">{g.memberCount ?? 0} members</StatusPill>
                <span className="text-[11px] tabular-nums text-zinc-400">
                  {g.createdAt ? fmtDate(g.createdAt) : '-'}
                </span>
              </div>
            </m.article>
          ))}
        </div>
      )}
    </WaPage>
  );
}
