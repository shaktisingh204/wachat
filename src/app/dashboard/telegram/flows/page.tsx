'use client';

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import { Plus, Trash2, Workflow } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  deleteTelegramFlowAction,
  listTelegramFlowsAction,
  upsertTelegramFlowAction,
} from '@/app/actions/telegram-extra.actions';
import type { ReplyRow } from '@/lib/rust-client/telegram-flows';

import {
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

export default function TelegramFlowsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';
  const { toast } = useZoruToast();

  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [busy, startBusy] = useTransition();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReplyRow | null>(null);
  const [shortcut, setShortcut] = useState('');
  const [text, setText] = useState('');

  const refresh = async () => {
    if (!projectId) return;
    setReplies(await listTelegramFlowsAction(projectId));
  };
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const openCreate = () => {
    setEditing(null);
    setShortcut('');
    setText('');
    setOpen(true);
  };

  const openEdit = (r: ReplyRow) => {
    setEditing(r);
    setShortcut(r.shortcut);
    setText(r.text);
    setOpen(true);
  };

  const onSave = () => {
    if (!projectId || !shortcut.trim() || !text.trim()) return;
    startBusy(async () => {
      const res = await upsertTelegramFlowAction({
        projectId,
        replyId: editing?._id,
        shortcut: shortcut.trim(),
        text: text.trim(),
      });
      if (!res.success) {
        toast({ title: 'Save failed', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Saved' });
      setOpen(false);
      refresh();
    });
  };

  const onDelete = (replyId: string) => {
    if (!projectId) return;
    if (!confirm('Delete this quick reply?')) return;
    startBusy(async () => {
      const res = await deleteTelegramFlowAction(replyId, projectId);
      if (!res.success) {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
        return;
      }
      refresh();
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState
          icon={<Workflow />}
          title="No project selected"
          description="Pick a project."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #37BBFE 0%, #007DBB 100%)',
              boxShadow: '0 10px 28px rgba(0, 125, 187, 0.25)',
            }}
          >
            <Workflow className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[22px] leading-tight text-zoru-ink">Flows</h1>
            <p className="mt-1 text-[13.5px] text-zoru-ink-muted">
              Reusable quick-reply shortcuts agents can pick from in chat. Backed by{' '}
              <code>telegram-flows</code>.
            </p>
          </div>
        </div>
        <ZoruButton size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New
        </ZoruButton>
      </header>

      {replies.length === 0 ? (
        <ZoruEmptyState
          icon={<Workflow />}
          title="No flows yet"
          description="Add a shortcut like /price → 'Our pricing is…'"
        />
      ) : (
        <ZoruCard className="flex flex-col divide-y divide-zoru-line p-3">
          {replies.map((r) => (
            <div
              key={r._id}
              className="flex items-start justify-between gap-3 px-2 py-3"
            >
              <button
                type="button"
                onClick={() => openEdit(r)}
                className="flex-1 text-left"
              >
                <p className="font-mono text-sm text-zoru-ink">/{r.shortcut}</p>
                <p className="line-clamp-2 text-[12px] text-zoru-ink-muted">{r.text}</p>
              </button>
              <ZoruButton
                variant="ghost"
                size="sm"
                onClick={() => onDelete(r._id)}
                disabled={busy}
              >
                <Trash2 className="h-4 w-4" />
              </ZoruButton>
            </div>
          ))}
        </ZoruCard>
      )}

      <ZoruDialog open={open} onOpenChange={setOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>{editing ? 'Edit flow' : 'New flow'}</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <ZoruLabel htmlFor="f-short">Shortcut</ZoruLabel>
              <ZoruInput
                id="f-short"
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value.replace(/^\//, ''))}
                placeholder="price"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="f-text">Reply text</ZoruLabel>
              <ZoruTextarea
                id="f-text"
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </ZoruButton>
            <ZoruButton onClick={onSave} disabled={busy || !shortcut.trim() || !text.trim()}>
              {busy ? 'Saving…' : 'Save'}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
