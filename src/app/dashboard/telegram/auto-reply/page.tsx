'use client';

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Bot, Plus, Reply, Trash2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  deleteTelegramAutoReplyRule,
  listTelegramAutoReplyRules,
  listTelegramBots,
  toggleTelegramAutoReplyRule,
  upsertTelegramAutoReplyRule,
  type TelegramAutoReplyRuleRow,
  type TelegramBotListRow,
} from '@/app/actions/telegram.actions';

import {
  ZoruBadge,
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
  ZoruSwitch,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

export default function TelegramAutoReplyPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';
  const { toast } = useZoruToast();

  const [bots, setBots] = useState<TelegramBotListRow[]>([]);
  const [botId, setBotId] = useState<string>('');
  const [rules, setRules] = useState<TelegramAutoReplyRuleRow[]>([]);
  const [busy, startBusy] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [pattern, setPattern] = useState('');
  const [matchMode, setMatchMode] = useState<'contains' | 'exact' | 'starts_with'>('contains');
  const [responseText, setResponseText] = useState('');

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const list = await listTelegramBots(projectId);
      setBots(list);
      if (!botId && list.length > 0) setBotId(list[0]._id);
    })();
  }, [projectId, botId]);

  const refresh = useCallback(() => {
    if (!botId) return;
    (async () => setRules(await listTelegramAutoReplyRules(botId)))();
  }, [botId]);

  useEffect(() => {
    if (botId) refresh();
  }, [botId, refresh]);

  const onCreate = () => {
    if (!botId || !name.trim() || !responseText.trim()) return;
    startBusy(async () => {
      const res = await upsertTelegramAutoReplyRule({
        botId,
        name: name.trim(),
        trigger: { kind: 'keyword' } as any,
        pattern: pattern.trim() || undefined,
        matchMode,
        response: { type: 'text', text: responseText.trim() } as any,
        isActive: true,
        priority: 100,
      });
      if (!res.success) {
        toast({
          title: 'Could not save',
          description: res.error ?? 'Unknown',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Rule saved' });
      setDialogOpen(false);
      setName('');
      setPattern('');
      setResponseText('');
      refresh();
    });
  };

  const onToggle = (ruleId: string, isActive: boolean) => {
    if (!botId) return;
    startBusy(async () => {
      const res = await toggleTelegramAutoReplyRule({ botId, ruleId, isActive });
      if (!res.success) {
        toast({ title: 'Toggle failed', description: res.error, variant: 'destructive' });
        return;
      }
      refresh();
    });
  };

  const onDelete = (ruleId: string) => {
    if (!botId) return;
    if (!confirm('Delete this rule?')) return;
    startBusy(async () => {
      const res = await deleteTelegramAutoReplyRule({ botId, ruleId });
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
          icon={<Reply />}
          title="No project selected"
          description="Pick a project."
        />
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
            <Reply className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[22px] leading-tight text-zoru-ink">Auto-reply rules</h1>
            <p className="mt-1 text-[13.5px] text-zoru-ink-muted">
              Trigger replies when inbound messages match a pattern. Backed by{' '}
              <code>telegram-auto-reply</code>.
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
          <ZoruButton size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New rule
          </ZoruButton>
        </div>
      </header>

      {rules.length === 0 ? (
        <ZoruEmptyState
          icon={<Reply />}
          title="No rules yet"
          description="Add a rule to auto-reply when users message this bot."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rules.map((r) => (
            <ZoruCard key={r._id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base text-zoru-ink">{r.name}</p>
                  <p className="text-[11px] text-zoru-ink-muted">
                    {r.matchMode}
                    {r.pattern ? ` · ${r.pattern}` : ''}
                  </p>
                </div>
                <ZoruSwitch
                  checked={r.isActive}
                  onCheckedChange={(v) => onToggle(r._id, Boolean(v))}
                  disabled={busy}
                />
              </div>
              <p className="line-clamp-3 text-sm text-zoru-ink-muted">
                {r.response?.text ?? '(no response text)'}
              </p>
              <footer className="flex items-center justify-between border-t border-zoru-line pt-3">
                <ZoruBadge variant="ghost">priority {r.priority}</ZoruBadge>
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(r._id)}
                  disabled={busy}
                >
                  <Trash2 className="h-4 w-4" />
                </ZoruButton>
              </footer>
            </ZoruCard>
          ))}
        </div>
      )}

      <ZoruDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New auto-reply rule</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <ZoruLabel htmlFor="r-name">Name</ZoruLabel>
              <ZoruInput
                id="r-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Greet new users"
              />
            </div>
            <div>
              <ZoruLabel>Match mode</ZoruLabel>
              <div className="mt-1 flex items-center gap-2">
                {(['contains', 'exact', 'starts_with'] as const).map((m) => (
                  <ZoruButton
                    key={m}
                    type="button"
                    size="sm"
                    variant={matchMode === m ? 'default' : 'outline'}
                    onClick={() => setMatchMode(m)}
                  >
                    {m}
                  </ZoruButton>
                ))}
              </div>
            </div>
            <div>
              <ZoruLabel htmlFor="r-pattern">Pattern</ZoruLabel>
              <ZoruInput
                id="r-pattern"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="hello"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="r-resp">Reply text</ZoruLabel>
              <ZoruTextarea
                id="r-resp"
                rows={4}
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Hi there! How can we help?"
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setDialogOpen(false)} disabled={busy}>
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={onCreate}
              disabled={busy || !name.trim() || !responseText.trim()}
            >
              {busy ? 'Saving…' : 'Save'}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
