'use client';

/**
 * /wachat/message-tags — manage conversation tags.
 * ZoruUI: header + breadcrumb, ZoruDataTable, ZoruColorPicker (neutral
 * palette), edit-tag dialog, delete alert dialog.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

import { useProject } from '@/context/project-context';
import {
  getMessageTags,
  saveMessageTag,
  deleteMessageTag,
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
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruColorPicker,
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
  ZoruSkeleton,
  useZoruToast,
} from '@/components/zoruui';

interface Tag {
  _id: string;
  name: string;
  color: string;
  usageCount?: number;
}

// Neutral-only palette — no rainbow accents.
const NEUTRAL_PRESETS = [
  '#0F0F10',
  '#27272A',
  '#3F3F46',
  '#52525B',
  '#71717A',
  '#A1A1AA',
  '#D4D4D8',
  '#E4E4E7',
  '#F4F4F5',
];

export default function MessageTagsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [isMutating, startMutateTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(NEUTRAL_PRESETS[0]);

  const [deleting, setDeleting] = useState<Tag | null>(null);

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getMessageTags(projectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setTags((res.tags ?? []) as Tag[]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setColor(NEUTRAL_PRESETS[0]);
    setDialogOpen(true);
  };

  const openEdit = (tag: Tag) => {
    setEditing(tag);
    setName(tag.name);
    setColor(tag.color || NEUTRAL_PRESETS[0]);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!name.trim() || !projectId) return;
    startMutateTransition(async () => {
      const res = await saveMessageTag(projectId, name.trim(), color);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({
        title: editing ? 'Tag updated' : 'Tag created',
        description: res.message ?? 'Saved.',
      });
      setName('');
      setDialogOpen(false);
      setEditing(null);
      fetchData();
    });
  };

  const handleDelete = () => {
    if (!deleting) return;
    startMutateTransition(async () => {
      const res = await deleteMessageTag(deleting._id);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Deleted', description: 'Tag removed.' });
      setDeleting(null);
      fetchData();
    });
  };

  const columns = useMemo<ColumnDef<Tag>[]>(
    () => [
      {
        id: 'swatch',
        header: '',
        cell: ({ row }) => (
          <span
            className="block h-4 w-4 rounded-full border border-zoru-line"
            style={{ backgroundColor: row.original.color }}
            aria-label={`Tag color ${row.original.color}`}
          />
        ),
      },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <span className="text-zoru-ink">{row.original.name}</span>
        ),
      },
      {
        accessorKey: 'usageCount',
        header: 'Messages',
        cell: ({ row }) => (
          <span className="tabular-nums text-zoru-ink-muted">
            {row.original.usageCount ?? 0}
          </span>
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
              onClick={() => setDeleting(row.original)}
            >
              <Trash2 />
            </ZoruButton>
          </div>
        ),
      },
    ],
    [],
  );

  if (isLoading && tags.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
        <ZoruSkeleton className="h-3 w-52" />
        <div className="mt-5 space-y-3">
          <ZoruSkeleton className="h-9 w-72" />
          <ZoruSkeleton className="h-4 w-96" />
        </div>
        <div className="mt-8 grid gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-12" />
          ))}
        </div>
      </div>
    );
  }

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
            <ZoruBreadcrumbPage>Message Tags</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>
            WaChat · {activeProject?.name ?? 'Project'}
          </ZoruPageEyebrow>
          <ZoruPageTitle>Message Tags</ZoruPageTitle>
          <ZoruPageDescription>
            Create and manage tags to organize your conversations.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton onClick={openCreate}>
            <Plus /> New tag
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      <div className="mt-6">
        {tags.length === 0 ? (
          <ZoruEmptyState
            icon={<Tag />}
            title="No tags yet"
            description="Create tags to keep conversations organized and easy to filter."
            action={
              <ZoruButton onClick={openCreate}>
                <Plus /> New tag
              </ZoruButton>
            }
          />
        ) : (
          <ZoruCard className="p-4">
            <ZoruDataTable
              columns={columns}
              data={tags}
              filterColumn="name"
              filterPlaceholder="Search tags…"
            />
          </ZoruCard>
        )}
      </div>

      {/* Create / edit tag dialog */}
      <ZoruDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            setName('');
          }
        }}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {editing ? 'Edit tag' : 'New tag'}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Pick a name and a neutral color to make this tag easy to spot.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="tag-name">Name</ZoruLabel>
            <ZoruInput
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              placeholder="Tag name"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <ZoruLabel>Color</ZoruLabel>
            <ZoruColorPicker
              value={color}
              onChange={setColor}
              presets={NEUTRAL_PRESETS}
            />
          </div>

          <ZoruDialogFooter>
            <ZoruButton
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditing(null);
                setName('');
              }}
            >
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={handleSave}
              disabled={isMutating || !name.trim()}
            >
              {editing ? 'Save changes' : 'Create tag'}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* Delete tag alert */}
      <ZoruAlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Delete &ldquo;{deleting?.name}&rdquo;?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This removes the tag and detaches it from any conversations using
              it. This cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={handleDelete}
              disabled={isMutating}
            >
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
