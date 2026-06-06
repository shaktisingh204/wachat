'use client';

/**
 * Notebook hub grid.
 *
 * Renders every active SabNotebook for the signed-in user, plus a
 * pinned "Quick Notes" tile that opens the legacy sticky-notes board.
 * "+ New notebook" opens a creation dialog (color + SabFiles cover).
 *
 * NOTE: This component is mounted under the sticky-notes route so existing
 * deep links keep working; the URL stays `/dashboard/crm/workspace/sticky-notes`.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Notebook, Plus, StickyNote, Zap } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  Textarea,
  zoruSonnerToast,
} from '@/components/sabcrm/20ui/compat';
import { SabFilePickerButton } from '@/components/sabfiles';
import {
  createSabnotebookNotebook,
  deleteSabnotebookNotebook,
} from '@/app/actions/sabnotebook.actions';
import type { SabnotebookNotebook } from '@/lib/rust-client/sabnotebook-notebooks';

const BASE = '/dashboard/crm/workspace/sticky-notes';

const COLOR_TOKENS = [
  { value: '#6366f1', label: 'Indigo' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#0ea5e9', label: 'Sky' },
  { value: '#64748b', label: 'Slate' },
];

interface NotebookGridProps {
  initialNotebooks: SabnotebookNotebook[];
  quickNotebookId: string | null;
}

export function NotebookGrid({
  initialNotebooks,
  quickNotebookId,
}: NotebookGridProps): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [color, setColor] = React.useState<string>(COLOR_TOKENS[0]!.value);
  const [coverFileId, setCoverFileId] = React.useState<string | undefined>();

  const resetForm = React.useCallback(() => {
    setName('');
    setDescription('');
    setColor(COLOR_TOKENS[0]!.value);
    setCoverFileId(undefined);
  }, []);

  const handleCreate = React.useCallback(async () => {
    if (!name.trim()) {
      zoruSonnerToast.error('Name is required');
      return;
    }
    setCreating(true);
    const res = await createSabnotebookNotebook({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      coverFileId,
    });
    setCreating(false);
    if (res.error) {
      zoruSonnerToast.error(res.error);
      return;
    }
    zoruSonnerToast.success('Notebook created');
    setOpen(false);
    resetForm();
    if (res.id) router.push(`${BASE}/${res.id}`);
    else router.refresh();
  }, [name, description, color, coverFileId, resetForm, router]);

  const handleArchive = React.useCallback(
    async (id: string) => {
      const res = await deleteSabnotebookNotebook(id);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      zoruSonnerToast.success('Notebook archived');
      router.refresh();
    },
    [router],
  );

  // Non-quick notebooks render in the grid; the quick-notes tile is rendered
  // separately so it always appears first.
  const others = React.useMemo(
    () => initialNotebooks.filter((n) => n._id !== quickNotebookId),
    [initialNotebooks, quickNotebookId],
  );

  return (
    <div className="zoruui flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
          <p className="text-sm text-[var(--st-text-secondary)]">
            Quick sticky notes, structured notebooks, audio captures, sketches
            — all in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`${BASE}/quick`}>
            <Button variant="outline">
              <Zap className="h-4 w-4" /> Quick capture
            </Button>
          </Link>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New notebook
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Quick Notes tile — always first, always pinned */}
        <Card
          className="group relative overflow-hidden"
          style={{ borderTop: '4px solid #f59e0b' }}
        >
          <Link
            href={`${BASE}#quick-notes`}
            className="absolute inset-0 z-10"
            aria-label="Open Quick Notes"
          />
          <CardHeader className="flex flex-row items-center gap-2">
            <StickyNote className="h-4 w-4 text-[var(--st-text)]" />
            <CardTitle className="line-clamp-1">Quick Notes</CardTitle>
          </CardHeader>
          <CardContent className="min-h-[60px]">
            <p className="line-clamp-3 text-sm text-[var(--st-text-secondary)]">
              Your sticky-notes board. Jump-in for quick reminders without
              picking a section.
            </p>
          </CardContent>
          <CardFooter className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
            <Badge variant="secondary">Always pinned</Badge>
          </CardFooter>
        </Card>

        {others.map((nb) => {
          const nbId = String(nb._id);
          return (
          <Card
            key={nbId}
            className="group relative overflow-hidden"
            style={{ borderTop: `4px solid ${nb.color ?? '#6366f1'}` }}
          >
            <Link
              href={`${BASE}/${nbId}`}
              className="absolute inset-0 z-10"
              aria-label={`Open ${nb.name}`}
            />
            <CardHeader className="flex flex-row items-center gap-2">
              <Notebook className="h-4 w-4 text-[var(--st-text-secondary)]" />
              <CardTitle className="line-clamp-1">{nb.name}</CardTitle>
            </CardHeader>
            <CardContent className="min-h-[60px]">
              <p className="line-clamp-3 text-sm text-[var(--st-text-secondary)]">
                {nb.description ?? 'No description.'}
              </p>
            </CardContent>
            <CardFooter className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
              <Badge variant="secondary">{nb.noteCount ?? 0} notes</Badge>
              <Button
                variant="ghost"
                size="sm"
                className="relative z-20"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleArchive(nbId);
                }}
              >
                Archive
              </Button>
            </CardFooter>
          </Card>
          );
        })}
      </section>

      {others.length === 0 && (
        <EmptyState
          title="Spin up your first notebook"
          description="Notebooks group related notes into sections — perfect for projects, journals, or research."
          actions={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New notebook
            </Button>
          }
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New notebook</ZoruDialogTitle>
            <ZoruDialogDescription>
              Notebooks group related notes. You can change the cover and
              color later.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nb-name">Name</Label>
              <Input
                id="nb-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Daily Journal"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nb-desc">Description</Label>
              <Textarea
                id="nb-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional short description"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_TOKENS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    aria-label={c.label}
                    onClick={() => setColor(c.value)}
                    className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c.value,
                      borderColor:
                        color === c.value
                          ? 'var(--st-text)'
                          : 'transparent',
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Cover image (optional)</Label>
              <SabFilePickerButton
                accept="image"
                onPick={(pick) => setCoverFileId(pick?.id)}
              >
                {coverFileId ? 'Change cover' : 'Pick from SabFiles'}
              </SabFilePickerButton>
            </div>
          </div>
          <ZoruDialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
