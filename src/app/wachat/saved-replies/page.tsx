'use client';

/**
 * /wachat/saved-replies — manage shortcut replies for conversations.
 * ZoruUI: ZoruPageHeader + ZoruBreadcrumb, ZoruDataTable per category,
 * dialog for create/edit, ZoruEmptyState for zero rows.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  MessageSquare,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

import { useProject } from '@/context/project-context';
import {
  getSavedReplies,
  saveSavedReply,
  deleteSavedReply,
} from '@/app/actions/wachat-features.actions';

import {
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDataTable,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

const CATEGORIES = [
  { value: 'General', label: 'General' },
  { value: 'Sales', label: 'Sales' },
  { value: 'Support', label: 'Support' },
  { value: 'Onboarding', label: 'Onboarding' },
  { value: 'Billing', label: 'Billing' },
];

interface Reply {
  _id: string;
  shortcut: string;
  title: string;
  body: string;
  category: string;
  mediaUrl?: string;
}

export default function SavedRepliesPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Reply | null>(null);

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getSavedReplies(String(activeProject._id));
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setReplies((res.replies ?? []) as Reply[]);
    });
  }, [activeProject?._id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (reply: Reply) => {
    setEditing(reply);
    setDialogOpen(true);
  };

  const handleSave = async (fd: FormData) => {
    fd.set('projectId', String(activeProject?._id ?? ''));
    if (editing?._id) fd.set('replyId', editing._id);
    const res = await saveSavedReply(null, fd);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
      return;
    }
    toast({ title: res.message ?? 'Reply saved.' });
    setDialogOpen(false);
    setEditing(null);
    load();
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteSavedReply(id);
      if (!res.success) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Reply deleted.' });
      load();
    });
  };

  const columns = useMemo<ColumnDef<Reply>[]>(
    () => [
      {
        accessorKey: 'shortcut',
        header: 'Shortcut',
        cell: ({ row }) => (
          <span className="font-mono text-[12px] text-zoru-ink">
            {row.original.shortcut}
          </span>
        ),
      },
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) => (
          <span className="truncate text-zoru-ink">{row.original.title}</span>
        ),
      },
      {
        accessorKey: 'body',
        header: 'Body',
        cell: ({ row }) => (
          <span className="line-clamp-1 text-zoru-ink-muted">
            {row.original.body}
          </span>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) => (
          <ZoruBadge variant="outline">{row.original.category}</ZoruBadge>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <ZoruButton
              variant="ghost"
              size="icon-sm"
              aria-label="Edit"
              onClick={() => openEdit(row.original)}
            >
              <Pencil />
            </ZoruButton>
            <ZoruButton
              variant="ghost"
              size="icon-sm"
              aria-label="Delete"
              onClick={() => handleDelete(row.original._id)}
            >
              <Trash2 />
            </ZoruButton>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
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
            <ZoruBreadcrumbPage>Saved Replies</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>WaChat</ZoruPageEyebrow>
          <ZoruPageTitle>Saved Replies</ZoruPageTitle>
          <ZoruPageDescription>
            Create shortcut replies your team can use in conversations.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton onClick={openCreate}>
            <Plus /> New reply
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      <div className="mt-6">
        {isPending && replies.length === 0 ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <ZoruSkeleton key={i} className="h-12" />
            ))}
          </div>
        ) : replies.length === 0 ? (
          <ZoruEmptyState
            icon={<MessageSquare />}
            title="No saved replies yet"
            description="Create shortcuts your team can drop into any conversation."
            action={
              <ZoruButton onClick={openCreate}>
                <Plus /> New reply
              </ZoruButton>
            }
          />
        ) : (
          <ZoruCard className="p-4">
            <ZoruDataTable
              columns={columns}
              data={replies}
              filterColumn="title"
              filterPlaceholder="Search replies…"
            />
          </ZoruCard>
        )}
      </div>

      {/* Create / edit dialog */}
      <ZoruDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {editing ? 'Edit reply' : 'New reply'}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Fill in the shortcut and body. Optional media URL is supported.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <form
            action={handleSave}
            className="flex flex-col gap-4"
            id="saved-reply-form"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <ZoruLabel htmlFor="shortcut">Shortcut</ZoruLabel>
                <ZoruInput
                  id="shortcut"
                  name="shortcut"
                  placeholder="/greeting"
                  required
                  defaultValue={editing?.shortcut ?? ''}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <ZoruLabel htmlFor="title">Title</ZoruLabel>
                <ZoruInput
                  id="title"
                  name="title"
                  placeholder="Quick hello"
                  defaultValue={editing?.title ?? ''}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="category">Category</ZoruLabel>
              <ZoruSelect
                name="category"
                defaultValue={editing?.category ?? 'General'}
              >
                <ZoruSelectTrigger id="category">
                  <ZoruSelectValue placeholder="Pick a category" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {CATEGORIES.map((c) => (
                    <ZoruSelectItem key={c.value} value={c.value}>
                      {c.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="body">Body</ZoruLabel>
              <ZoruTextarea
                id="body"
                name="body"
                rows={4}
                required
                defaultValue={editing?.body ?? ''}
                placeholder="Type the reply body…"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="mediaUrl">Media URL (optional)</ZoruLabel>
              <ZoruInput
                id="mediaUrl"
                name="mediaUrl"
                placeholder="https://…"
                defaultValue={editing?.mediaUrl ?? ''}
              />
            </div>
          </form>

          <ZoruDialogFooter>
            <ZoruButton
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditing(null);
              }}
            >
              Cancel
            </ZoruButton>
            <ZoruButton type="submit" form="saved-reply-form">
              {editing ? 'Save changes' : 'Create reply'}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
