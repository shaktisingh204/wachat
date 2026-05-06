'use client';

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Bot, Hash, Plus, Save, Trash2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getTelegramBotCommands,
  listTelegramBots,
  setTelegramBotCommands,
  type TelegramBotListRow,
} from '@/app/actions/telegram.actions';

import {
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  useZoruToast,
} from '@/components/zoruui';

interface Cmd {
  command: string;
  description: string;
}

export default function TelegramCommandsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';
  const { toast } = useZoruToast();

  const [bots, setBots] = useState<TelegramBotListRow[]>([]);
  const [botId, setBotId] = useState<string>('');
  const [cmds, setCmds] = useState<Cmd[]>([]);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const list = await listTelegramBots(projectId);
      setBots(list);
      if (!botId && list.length > 0) setBotId(list[0]._id);
    })();
  }, [projectId, botId]);

  useEffect(() => {
    if (!botId) return;
    (async () => setCmds(await getTelegramBotCommands(botId)))();
  }, [botId]);

  const addRow = () => setCmds((s) => [...s, { command: '', description: '' }]);
  const removeRow = (i: number) => setCmds((s) => s.filter((_, idx) => idx !== i));
  const setRow = (i: number, k: keyof Cmd, v: string) =>
    setCmds((s) => s.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));

  const onSave = () => {
    if (!botId) return;
    const cleaned = cmds
      .map((c) => ({
        command: c.command.replace(/^\//, '').trim().toLowerCase(),
        description: c.description.trim(),
      }))
      .filter((c) => c.command && c.description);
    startBusy(async () => {
      const res = await setTelegramBotCommands(botId, cleaned);
      if (!res.success) {
        toast({
          title: 'Save failed',
          description: res.error ?? 'Unknown',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Commands saved', description: res.message });
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState icon={<Hash />} title="No project selected" description="Pick a project." />
      </div>
    );
  }
  if (bots.length === 0) {
    return (
      <div className="p-6">
        <ZoruEmptyState
          icon={<Bot />}
          title="No bots connected"
          description="Connect a bot first."
          action={
            <ZoruButton asChild>
              <Link href="/dashboard/telegram/bots">Manage bots</Link>
            </ZoruButton>
          }
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
            <Hash className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[22px] leading-tight text-zoru-ink">Slash commands</h1>
            <p className="mt-1 text-[13.5px] text-zoru-ink-muted">
              The command list shown in Telegram. Backed by{' '}
              <code>telegram-commands</code>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {bots.map((b) => (
            <ZoruButton
              key={b._id}
              variant={botId === b._id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setBotId(b._id)}
            >
              @{b.username}
            </ZoruButton>
          ))}
        </div>
      </header>

      <ZoruCard className="flex flex-col gap-3 p-5">
        {cmds.length === 0 ? (
          <p className="text-sm text-zoru-ink-muted">
            No commands set yet. Click &ldquo;Add&rdquo; to create one.
          </p>
        ) : (
          <div className="grid grid-cols-[1fr_2fr_auto] gap-2">
            <ZoruLabel className="text-xs text-zoru-ink-muted">Command</ZoruLabel>
            <ZoruLabel className="text-xs text-zoru-ink-muted">Description</ZoruLabel>
            <span />
            {cmds.map((c, i) => (
              <React.Fragment key={i}>
                <ZoruInput
                  value={c.command}
                  onChange={(e) => setRow(i, 'command', e.target.value)}
                  placeholder="start"
                />
                <ZoruInput
                  value={c.description}
                  onChange={(e) => setRow(i, 'description', e.target.value)}
                  placeholder="Begin onboarding"
                />
                <ZoruButton variant="ghost" size="sm" onClick={() => removeRow(i)}>
                  <Trash2 className="h-4 w-4" />
                </ZoruButton>
              </React.Fragment>
            ))}
          </div>
        )}
        <footer className="flex items-center justify-between border-t border-zoru-line pt-3">
          <ZoruButton variant="ghost" size="sm" onClick={addRow}>
            <Plus className="mr-2 h-4 w-4" />
            Add command
          </ZoruButton>
          <ZoruButton onClick={onSave} disabled={busy}>
            <Save className="mr-2 h-4 w-4" />
            {busy ? 'Saving…' : 'Save'}
          </ZoruButton>
        </footer>
      </ZoruCard>
    </div>
  );
}
