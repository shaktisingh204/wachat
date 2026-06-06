'use client';

/**
 * Top-level layout for the email template builder.
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ header: name input · Save · Preview · warnings count             │
 *   ├──────────┬──────────────────────────────────┬─────────────────────┤
 *   │ palette  │ canvas                           │ inspector           │
 *   │ (LH rail)│ (block list w/ hover toolbar)    │ (per-block fields)  │
 *   └──────────┴──────────────────────────────────┴─────────────────────┘
 *
 * Document state lives here in one `useState<EmailBuilderDocument>`.
 * All children receive immutable snapshots + setters.
 */
import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Eye, Save } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle, Badge, Button, Input, Separator, toast } from '@/components/sabcrm/20ui';
import type {
  EmailBuilderBlock,
  EmailBuilderDocument,
} from '@/lib/email/types';
import {
  actionRenderEmailTemplate,
  actionUpdateEmailTemplate,
} from '@/app/actions/email/templates.actions';

import { BlockPalette } from './block-palette';
import { BuilderCanvas } from './builder-canvas';
import { BlockInspector } from './block-inspector';
import { DevicePreview } from './device-preview';
import { emptyDocument } from './block-defaults';

export interface BuilderShellProps {
  templateId: string;
  initialName: string;
  initialSubject?: string;
  initialDoc: EmailBuilderDocument;
}

export function BuilderShell({
  templateId,
  initialName,
  initialSubject,
  initialDoc,
}: BuilderShellProps) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [subject, setSubject] = useState(initialSubject ?? '');
  const [doc, setDoc] = useState<EmailBuilderDocument>(initialDoc ?? emptyDocument());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [warnings, setWarnings] = useState<string[]>([]);

  const [savePending, startSave] = useTransition();
  const [previewPending, startPreview] = useTransition();

  const selectedBlock = useMemo<EmailBuilderBlock | null>(() => {
    if (!selectedId) return null;
    return doc.blocks.find((b) => b.id === selectedId) ?? null;
  }, [doc.blocks, selectedId]);

  /* ────────── Block mutations ────────── */

  const handleAddBlock = useCallback((block: EmailBuilderBlock) => {
    setDoc((d) => ({ ...d, blocks: [...d.blocks, block] }));
    setSelectedId(block.id);
  }, []);

  const handleBlockChange = useCallback((next: EmailBuilderBlock) => {
    setDoc((d) => ({
      ...d,
      blocks: d.blocks.map((b) => (b.id === next.id ? next : b)),
    }));
  }, []);

  const handleSettingsChange = useCallback(
    (settings: EmailBuilderDocument['settings']) => {
      setDoc((d) => ({ ...d, settings }));
    },
    [],
  );

  const handleMove = useCallback((id: string, dir: 'up' | 'down') => {
    setDoc((d) => {
      const idx = d.blocks.findIndex((b) => b.id === id);
      if (idx < 0) return d;
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= d.blocks.length) return d;
      const next = [...d.blocks];
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...d, blocks: next };
    });
  }, []);

  const handleDuplicate = useCallback((id: string) => {
    setDoc((d) => {
      const idx = d.blocks.findIndex((b) => b.id === id);
      if (idx < 0) return d;
      const orig = d.blocks[idx];
      const clone: EmailBuilderBlock = {
        ...orig,
        id: `${orig.id}-copy-${Date.now().toString(36)}`,
        children: orig.children?.map((c) => ({
          ...c,
          id: `${c.id}-copy-${Date.now().toString(36)}`,
        })),
      };
      const next = [...d.blocks];
      next.splice(idx + 1, 0, clone);
      return { ...d, blocks: next };
    });
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      setDoc((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) }));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [],
  );

  /* ────────── Save + preview ────────── */

  const handleSave = useCallback(() => {
    startSave(async () => {
      const res = await actionUpdateEmailTemplate(templateId, {
        name,
        subject,
        builderJson: doc,
      });
      if (res.ok) {
        toast({ title: 'Template saved' });
      } else {
        toast({ title: 'Save failed', description: res.error, variant: 'destructive' });
      }
    });
  }, [templateId, name, subject, doc]);

  const handlePreview = useCallback(() => {
    startPreview(async () => {
      // Save before preview so the rendered HTML reflects the latest doc.
      const saveRes = await actionUpdateEmailTemplate(templateId, {
        name,
        subject,
        builderJson: doc,
      });
      if (!saveRes.ok) {
        toast({ title: 'Save before preview failed', description: saveRes.error, variant: 'destructive' });
        return;
      }
      const res = await actionRenderEmailTemplate(templateId);
      if (res.ok) {
        setPreviewHtml(res.data.html);
        setWarnings(res.data.warnings ?? []);
        setPreviewOpen(true);
      } else {
        toast({ title: 'Render failed', description: res.error, variant: 'destructive' });
      }
    });
  }, [templateId, name, subject, doc]);

  /* ────────── Render ────────── */

  return (
    <div className="flex h-screen flex-col bg-[var(--st-bg-secondary)]">
      <header className="flex items-center gap-3 border-b border-[var(--st-border)] px-4 py-2.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Back to templates"
          onClick={() => router.push('/dashboard/email/templates')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="max-w-xs"
            aria-label="Template name"
          />
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Default subject (optional)"
            className="max-w-md"
            aria-label="Default subject"
          />
        </div>
        {warnings.length > 0 ? (
          <Badge variant="outline" className="gap-1 text-[var(--st-text)]">
            <AlertTriangle className="h-3.5 w-3.5" />
            {warnings.length} warning{warnings.length === 1 ? '' : 's'}
          </Badge>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={handlePreview}
          disabled={previewPending}
        >
          <Eye /> {previewPending ? 'Rendering…' : 'Preview'}
        </Button>
        <Button type="button" onClick={handleSave} disabled={savePending}>
          <Save /> {savePending ? 'Saving…' : 'Save'}
        </Button>
      </header>

      {warnings.length > 0 ? (
        <div className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)] px-4 py-2 dark:bg-[var(--st-text)]/30">
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Renderer warnings</AlertTitle>
            <AlertDescription>
              <ul className="ml-4 list-disc text-xs">
                {warnings.map((w, i) => (
                  <li key={`${w}-${i}`}>{w}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <BlockPalette onAdd={handleAddBlock} />
        <Separator orientation="vertical" />
        <div className="flex min-w-0 flex-1 flex-col">
          <BuilderCanvas
            doc={doc}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={handleMove}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
          />
        </div>
        <Separator orientation="vertical" />
        <BlockInspector
          doc={doc}
          selected={selectedBlock}
          onChange={handleBlockChange}
          onSettingsChange={handleSettingsChange}
        />
      </div>

      <DevicePreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        html={previewHtml}
        warnings={warnings}
      />
    </div>
  );
}
