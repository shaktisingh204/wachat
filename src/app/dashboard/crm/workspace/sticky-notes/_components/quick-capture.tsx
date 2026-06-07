'use client';

/**
 * Quick capture surface.
 *
 * A minimal, distraction-free form for jotting a note into the user's
 * "Quick Notes" notebook. Kind is text by default but the user can switch
 * before saving. On save, redirects back to the hub.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';

import { Button, Card, Input, Select, Textarea, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from '@/components/sabcrm/20ui';
import { createSabnotebookNote } from '@/app/actions/sabnotebook.actions';
import type { SabnotebookNoteKind } from '@/lib/rust-client/sabnotebook-notes';

const BASE = '/dashboard/crm/workspace/sticky-notes';

interface QuickCaptureProps {
  notebookId: string;
  sectionId: string;
}

export function QuickCapture({ notebookId, sectionId }: QuickCaptureProps) {
  const router = useRouter();
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [kind, setKind] = React.useState<SabnotebookNoteKind>('text');
  const [saving, setSaving] = React.useState(false);

  const handleSave = React.useCallback(async () => {
    if (!body.trim() && !title.trim()) {
      toast.error('Add a title or some content');
      return;
    }
    setSaving(true);
    const res = await createSabnotebookNote({
      sectionId,
      notebookId,
      kind,
      title: title.trim() || undefined,
      blocksJson: JSON.stringify(
        kind === 'checklist'
          ? { kind: 'checklist', items: [] }
          : { kind: 'text', body: body.trim() },
      ),
      preview: body.trim().slice(0, 280) || title.trim().slice(0, 280),
    });
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Captured');
    if (res.id) {
      router.push(`${BASE}/${notebookId}?note=${res.id}`);
    } else {
      router.push(BASE);
    }
  }, [body, title, kind, notebookId, sectionId, router]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-6">
      <header className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push(BASE)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-lg font-semibold">Quick capture</h1>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
        </Button>
      </header>
      <Card className="flex flex-col gap-3 p-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="text-lg"
          autoFocus
        />
        <Select
          value={kind}
          onValueChange={(v) => setKind(v as SabnotebookNoteKind)}
        >
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder="Kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="checklist">Checklist</SelectItem>
          </SelectContent>
        </Select>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          placeholder="What's on your mind?"
        />
        <p className="text-xs text-[var(--st-text-secondary)]">
          Audio, sketch, and file kinds are available from the full editor.
        </p>
      </Card>
    </div>
  );
}
