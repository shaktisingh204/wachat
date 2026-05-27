'use client';

/**
 * NoteEditor — kind-aware editor on the right side of the notebook shell.
 *
 * Hosts text / checklist / audio / sketch / file editors and persists changes
 * via `updateSabnotebookNote`. The note body lives in `blocksJson`, shape:
 *
 *   text:      { kind: 'text', body: string }
 *   checklist: { kind: 'checklist', items: ChecklistItem[] }
 *   audio:     { kind: 'audio', fileId, name, mime, url, durationMs }
 *   sketch:    { kind: 'sketch', fileId, name, url }
 *   file:      { kind: 'file', fileId, name, mime, size, url }
 */

import * as React from 'react';
import { Archive, ArchiveRestore, Pin, PinOff, Save, Trash2 } from 'lucide-react';

import {
  Badge,
  Button,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  zoruSonnerToast,
} from '@/components/zoruui';
import {
  archiveSabnotebookNote,
  deleteSabnotebookNote,
  pinSabnotebookNote,
  updateSabnotebookNote,
} from '@/app/actions/sabnotebook.actions';
import type {
  SabnotebookNote,
  SabnotebookNoteKind,
} from '@/lib/rust-client/sabnotebook-notes';

import { TextEditor } from './note-editors/text-editor';
import {
  ChecklistEditor,
  type ChecklistItem,
} from './note-editors/checklist-editor';
import { AudioEditor, type AudioValue } from './note-editors/audio-editor';
import { SketchEditor, type SketchValue } from './note-editors/sketch-editor';
import { FileEditor, type FileValue } from './note-editors/file-editor';

const NOTE_KINDS: { value: SabnotebookNoteKind; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'audio', label: 'Audio' },
  { value: 'sketch', label: 'Sketch' },
  { value: 'file', label: 'File' },
];

interface NoteEditorProps {
  note: SabnotebookNote;
  onSaved?: (next: SabnotebookNote) => void;
  onDeleted?: (id: string) => void;
}

type Body =
  | { kind: 'text'; body: string }
  | { kind: 'checklist'; items: ChecklistItem[] }
  | { kind: 'audio'; value: AudioValue | null }
  | { kind: 'sketch'; value: SketchValue | null }
  | { kind: 'file'; value: FileValue | null };

function parseBody(note: SabnotebookNote): Body {
  const kind = (note.kind ?? 'text') as SabnotebookNoteKind;
  if (!note.blocksJson) {
    switch (kind) {
      case 'checklist':
        return { kind: 'checklist', items: [] };
      case 'audio':
        return { kind: 'audio', value: null };
      case 'sketch':
        return { kind: 'sketch', value: null };
      case 'file':
        return { kind: 'file', value: null };
      default:
        return { kind: 'text', body: '' };
    }
  }
  try {
    const raw = JSON.parse(note.blocksJson) as Record<string, unknown>;
    switch (kind) {
      case 'checklist':
        return {
          kind: 'checklist',
          items: Array.isArray(raw.items)
            ? (raw.items as ChecklistItem[])
            : [],
        };
      case 'audio':
        return { kind: 'audio', value: (raw as AudioValue) ?? null };
      case 'sketch':
        return { kind: 'sketch', value: (raw as SketchValue) ?? null };
      case 'file':
        return { kind: 'file', value: (raw as FileValue) ?? null };
      default:
        return {
          kind: 'text',
          body: typeof raw.body === 'string' ? raw.body : '',
        };
    }
  } catch {
    return { kind: 'text', body: note.preview ?? '' };
  }
}

function serializeBody(b: Body): { json: string; preview: string } {
  switch (b.kind) {
    case 'text':
      return {
        json: JSON.stringify({ kind: 'text', body: b.body }),
        preview: b.body.slice(0, 280),
      };
    case 'checklist': {
      const json = JSON.stringify({ kind: 'checklist', items: b.items });
      const preview = b.items
        .slice(0, 4)
        .map((i) => `${i.done ? '☑︎' : '☐'} ${i.text}`)
        .join(' · ');
      return { json, preview };
    }
    case 'audio':
      return {
        json: JSON.stringify({ kind: 'audio', ...(b.value ?? {}) }),
        preview: b.value?.name ? `🎙 ${b.value.name}` : '🎙 Audio note',
      };
    case 'sketch':
      return {
        json: JSON.stringify({ kind: 'sketch', ...(b.value ?? {}) }),
        preview: b.value?.name ? `✏️ ${b.value.name}` : '✏️ Sketch',
      };
    case 'file':
      return {
        json: JSON.stringify({ kind: 'file', ...(b.value ?? {}) }),
        preview: b.value?.name ? `📎 ${b.value.name}` : '📎 File',
      };
  }
}

export function NoteEditor({ note, onSaved, onDeleted }: NoteEditorProps) {
  const [title, setTitle] = React.useState(note.title ?? '');
  const [tags, setTags] = React.useState<string[]>(note.tags ?? []);
  const [body, setBody] = React.useState<Body>(() => parseBody(note));
  const [saving, setSaving] = React.useState(false);
  const [pinned, setPinned] = React.useState(!!note.pinned);
  const [archived, setArchived] = React.useState(!!note.archived);

  // Reset local state when the loaded note id changes.
  React.useEffect(() => {
    setTitle(note.title ?? '');
    setTags(note.tags ?? []);
    setBody(parseBody(note));
    setPinned(!!note.pinned);
    setArchived(!!note.archived);
  }, [note]);

  const handleKindChange = React.useCallback((next: SabnotebookNoteKind) => {
    setBody((prev) => {
      if (prev.kind === next) return prev;
      switch (next) {
        case 'checklist':
          return { kind: 'checklist', items: [] };
        case 'audio':
          return { kind: 'audio', value: null };
        case 'sketch':
          return { kind: 'sketch', value: null };
        case 'file':
          return { kind: 'file', value: null };
        default:
          return { kind: 'text', body: '' };
      }
    });
  }, []);

  const handleSave = React.useCallback(async () => {
    setSaving(true);
    const { json, preview } = serializeBody(body);
    const res = await updateSabnotebookNote(note._id, {
      title: title.trim() || undefined,
      kind: body.kind,
      blocksJson: json,
      preview,
      tags,
    });
    setSaving(false);
    if (res.error) {
      zoruSonnerToast.error(res.error);
      return;
    }
    zoruSonnerToast.success('Saved');
    if (res.entity) onSaved?.(res.entity);
  }, [body, note._id, title, tags, onSaved]);

  const handlePin = React.useCallback(async () => {
    const next = !pinned;
    setPinned(next);
    const res = await pinSabnotebookNote(note._id, next);
    if (res.error) {
      setPinned(!next);
      zoruSonnerToast.error(res.error);
      return;
    }
    if (res.entity) onSaved?.(res.entity);
  }, [pinned, note._id, onSaved]);

  const handleArchive = React.useCallback(async () => {
    const next = !archived;
    setArchived(next);
    const res = await archiveSabnotebookNote(note._id, next);
    if (res.error) {
      setArchived(!next);
      zoruSonnerToast.error(res.error);
      return;
    }
    if (res.entity) onSaved?.(res.entity);
  }, [archived, note._id, onSaved]);

  const handleDelete = React.useCallback(async () => {
    if (!confirm('Delete this note? This cannot be undone.')) return;
    const res = await deleteSabnotebookNote(note._id, note.notebookId);
    if (res.error) {
      zoruSonnerToast.error(res.error);
      return;
    }
    zoruSonnerToast.success('Note deleted');
    onDeleted?.(note._id);
  }, [note._id, note.notebookId, onDeleted]);

  return (
    <div className="flex h-full flex-col gap-3">
      <header className="flex flex-wrap items-center gap-2 border-b border-[var(--zoru-border)] pb-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled note"
          className="flex-1 text-lg font-medium"
        />
        <Select
          value={body.kind}
          onValueChange={(v) => handleKindChange(v as SabnotebookNoteKind)}
        >
          <ZoruSelectTrigger className="h-9 w-[130px]">
            <ZoruSelectValue placeholder="Kind" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {NOTE_KINDS.map((k) => (
              <ZoruSelectItem key={k.value} value={k.value}>
                {k.label}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePin}
          aria-label={pinned ? 'Unpin' : 'Pin'}
        >
          {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleArchive}
          aria-label={archived ? 'Unarchive' : 'Archive'}
        >
          {archived ? (
            <ArchiveRestore className="h-4 w-4" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
        </Button>
      </header>

      <TagInlineEditor value={tags} onChange={setTags} />

      <div className="min-h-0 flex-1 overflow-auto">
        {body.kind === 'text' && (
          <TextEditor
            value={body.body}
            onChange={(v) => setBody({ kind: 'text', body: v })}
          />
        )}
        {body.kind === 'checklist' && (
          <ChecklistEditor
            items={body.items}
            onChange={(items) => setBody({ kind: 'checklist', items })}
          />
        )}
        {body.kind === 'audio' && (
          <AudioEditor
            value={body.value}
            onChange={(v) => setBody({ kind: 'audio', value: v })}
          />
        )}
        {body.kind === 'sketch' && (
          <SketchEditor
            value={body.value}
            onChange={(v) => setBody({ kind: 'sketch', value: v })}
          />
        )}
        {body.kind === 'file' && (
          <FileEditor
            value={body.value}
            onChange={(v) => setBody({ kind: 'file', value: v })}
          />
        )}
      </div>
    </div>
  );
}

function TagInlineEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = React.useState('');

  const addTag = React.useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    if (value.includes(t)) {
      setDraft('');
      return;
    }
    onChange([...value, t]);
    setDraft('');
  }, [draft, value, onChange]);

  const removeTag = React.useCallback(
    (t: string) => {
      onChange(value.filter((x) => x !== t));
    },
    [value, onChange],
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((t) => (
        <Badge key={t} variant="secondary" className="gap-1">
          {t}
          <button
            type="button"
            onClick={() => removeTag(t)}
            aria-label={`Remove tag ${t}`}
            className="text-[var(--zoru-muted-foreground)] hover:text-[var(--zoru-foreground)]"
          >
            ×
          </button>
        </Badge>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag();
          }
        }}
        onBlur={addTag}
        placeholder="Add tag…"
        className="h-7 w-32 text-xs"
      />
    </div>
  );
}
