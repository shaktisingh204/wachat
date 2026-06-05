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
  Modal,
  EmptyState,
  Field,
  Input,
  Skeleton,
  Textarea,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { Plus,
  Trash2,
  Users } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getContactGroups, saveContactGroup, deleteContactGroup } from '@/app/actions/wachat-features.actions';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat Contact Groups — rebuilt on 20ui primitives.
 *
 * Same data, same handlers. Visual primitives swapped to 20ui.
 */

import * as React from 'react';

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
          tone: 'danger',
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
        tone: 'danger',
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
          tone: 'danger',
        });
        return;
      }
      toast({ title: 'Group deleted.' });
      load();
    });
  };

  const isLoadingInitial = isPending && groups.length === 0;

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Contacts', href: '/wachat/contacts' },
        { label: 'Groups' },
      ]}
      title="Contact Groups"
      description="Organise contacts into groups for targeted broadcasts."
      actions={
        <Button variant="primary" iconLeft={Plus} onClick={() => setCreateOpen(true)}>
          New Group
        </Button>
      }
    >
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create contact group"
        description="Group contacts together for targeted broadcasts."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-group-form"
              variant="primary"
              loading={submitting}
              disabled={submitting || !name.trim()}
            >
              Create group
            </Button>
          </>
        }
      >
        <form id="create-group-form" onSubmit={handleCreate} className="flex flex-col gap-4">
          <Field label="Name" required>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. VIP Customers"
              required
            />
          </Field>
          <Field label="Description">
            <Textarea
              id="group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </Field>
        </form>
      </Modal>

      {isLoadingInitial ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={128} />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No groups yet"
          description="Create your first group to start segmenting contacts."
          action={
            <Button variant="primary" iconLeft={Plus} onClick={() => setCreateOpen(true)}>
              Create group
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Card key={g._id} padding="lg" className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center"
                    style={{
                      borderRadius: 'var(--st-radius)',
                      background: 'var(--st-bg-secondary)',
                      color: 'var(--st-text)',
                    }}
                  >
                    <Users className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[14px]" style={{ color: 'var(--st-text)' }}>
                      {g.name}
                    </div>
                    {g.description && (
                      <div
                        className="mt-0.5 truncate text-[12px]"
                        style={{ color: 'var(--st-text-secondary)' }}
                      >
                        {g.description}
                      </div>
                    )}
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      label="Delete group"
                    />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete group?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the group "{g.name}". Contacts will
                        not be deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(g._id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div
                className="flex items-center justify-between pt-3 text-[12px]"
                style={{
                  borderTop: '1px solid var(--st-border)',
                  color: 'var(--st-text-secondary)',
                }}
              >
                <Badge tone="neutral">
                  {g.memberCount ?? 0} members
                </Badge>
                <span>
                  {g.createdAt
                    ? fmtDate(g.createdAt)
                    : '—'}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </WachatPage>
  );
}
