'use client';

/**
 * SabCreator — apps grid. ZoruUI primitives only; SabFiles for icons.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LayoutGrid, Plus, Rocket } from 'lucide-react';

import {
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogFooter,
  Input,
  Label,
  Textarea,
  PageHeader,
  ZoruPageTitle,
  ZoruPageDescription,
  ZoruPageActions,
  EmptyState,
  Badge,
} from '@/components/sabcrm/20ui/compat';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { createSabcreatorApp } from '@/app/actions/sabcreator.actions';
import type { SabcreatorAppDoc } from '@/lib/rust-client/sabcreator-apps';

interface Props {
  initialItems: SabcreatorAppDoc[];
}

export function AppsListClient({ initialItems }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconFileId, setIconFileId] = useState<string | undefined>(undefined);
  const [iconName, setIconName] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setName('');
    setDescription('');
    setIconFileId(undefined);
    setIconName(undefined);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const res = await createSabcreatorApp({
          name: name.trim(),
          description: description.trim() || undefined,
          iconFileId,
        });
        setItems((prev) => [res.entity, ...prev]);
        setOpen(false);
        reset();
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] createApp failed', err);
      }
    });
  };

  return (
    <div className="px-6 py-8 space-y-8">
      <PageHeader>
        <div>
          <ZoruPageTitle>SabCreator</ZoruPageTitle>
          <ZoruPageDescription>
            Build internal low-code apps backed by SabTables and SabFlow.
          </ZoruPageDescription>
        </div>
        <ZoruPageActions>
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> New app
          </Button>
        </ZoruPageActions>
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          icon={<Rocket className="size-8" />}
          title="No apps yet"
          description="Spin up your first low-code app. Forms write to SabTables, workflows fire SabFlow."
        >
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Create your first app
          </Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((app) => (
            <Card key={app._id} className="p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-md bg-zoru-surface-2 flex items-center justify-center shrink-0">
                    <LayoutGrid className="size-5 text-zoru-ink-muted" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{app.name}</div>
                    <div className="text-xs text-zoru-ink-muted truncate">/{app.slug}</div>
                  </div>
                </div>
                <Badge variant={app.status === 'published' ? 'default' : 'outline'}>
                  {app.status}
                </Badge>
              </div>
              {app.description ? (
                <p className="text-sm text-zoru-ink-muted line-clamp-2">{app.description}</p>
              ) : null}
              <div className="flex gap-2 mt-auto pt-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href={`/dashboard/sabcreator/${app._id}/builder`}>Open builder</Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/dashboard/sabcreator/${app._id}/preview`}>Preview</Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Create new app</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sc-app-name">App name</Label>
              <Input
                id="sc-app-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Inventory Tracker"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sc-app-desc">Description</Label>
              <Textarea
                id="sc-app-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short summary of what this app does."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>App icon</Label>
              <SabFilePickerButton
                accept="image"
                onPick={(pick: SabFilePick) => {
                  setIconFileId(pick.id);
                  setIconName(pick.name);
                }}
              >
                {iconName ? `Icon: ${iconName}` : 'Choose icon from SabFiles'}
              </SabFilePickerButton>
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={pending || !name.trim()}>
              {pending ? 'Creating…' : 'Create app'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
