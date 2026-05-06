'use client';

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Bot, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { listTelegramBots, type TelegramBotListRow } from '@/app/actions/telegram.actions';
import {
  createTelegramStickerSetAction,
  deleteTelegramStickerSetAction,
  listTelegramStickerSetsAction,
} from '@/app/actions/telegram-extra.actions';
import type { SetRow } from '@/lib/rust-client/telegram-stickers';

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
  useZoruToast,
} from '@/components/zoruui';

export default function TelegramStickersPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';
  const { toast } = useZoruToast();

  const [bots, setBots] = useState<TelegramBotListRow[]>([]);
  const [botId, setBotId] = useState<string>('');
  const [sets, setSets] = useState<SetRow[]>([]);
  const [busy, startBusy] = useTransition();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [stickerType, setStickerType] = useState<'regular' | 'mask' | 'custom_emoji'>('regular');

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const list = await listTelegramBots(projectId);
      setBots(list);
      if (!botId && list.length > 0) setBotId(list[0]._id);
    })();
  }, [projectId, botId]);

  const refresh = async () => {
    if (!botId) return;
    setSets(await listTelegramStickerSetsAction(botId));
  };
  useEffect(() => {
    if (botId) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const onCreate = () => {
    if (!botId || !name.trim() || !title.trim()) return;
    startBusy(async () => {
      const res = await createTelegramStickerSetAction({
        botId,
        name: name.trim(),
        title: title.trim(),
        stickerType,
      });
      if (!res.success) {
        toast({ title: 'Create failed', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Sticker set tracked' });
      setOpen(false);
      setName('');
      setTitle('');
      refresh();
    });
  };

  const onDelete = (setId: string) => {
    if (!botId) return;
    if (!confirm('Untrack this sticker set?')) return;
    startBusy(async () => {
      const res = await deleteTelegramStickerSetAction(setId, botId);
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
          icon={<ImageIcon />}
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
          action={<ZoruButton asChild><Link href="/dashboard/telegram/bots">Manage bots</Link></ZoruButton>}
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
            <ImageIcon className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[22px] leading-tight text-zoru-ink">Sticker sets</h1>
            <p className="mt-1 max-w-2xl text-[13.5px] text-zoru-ink-muted">
              Track sticker packs your bot owns. Create the pack on Telegram (via{' '}
              <Link
                className="underline decoration-zoru-line"
                href="https://t.me/stickers"
                target="_blank"
                rel="noopener noreferrer"
              >
                @stickers
              </Link>
              ), then register it here so it shows up in the dashboard.
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
          <ZoruButton size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Track pack
          </ZoruButton>
        </div>
      </header>

      {sets.length === 0 ? (
        <ZoruEmptyState
          icon={<ImageIcon />}
          title="No tracked packs"
          description="Add a pack short_name (e.g. cats_by_yourbot) to track it here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {sets.map((s) => (
            <ZoruCard key={s._id} className="flex flex-col gap-2 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base text-zoru-ink">{s.title}</p>
                  <p className="text-[11px] font-mono text-zoru-ink-muted">{s.name}</p>
                </div>
                <ZoruBadge variant="ghost">{s.stickerType}</ZoruBadge>
              </div>
              <div className="flex items-center justify-between text-xs text-zoru-ink-muted">
                <span>{s.stickerCount} stickers</span>
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(s._id)}
                  disabled={busy}
                >
                  <Trash2 className="h-4 w-4" />
                </ZoruButton>
              </div>
            </ZoruCard>
          ))}
        </div>
      )}

      <ZoruDialog open={open} onOpenChange={setOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Track a sticker pack</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <ZoruLabel htmlFor="s-name">Pack short_name</ZoruLabel>
              <ZoruInput
                id="s-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="cats_by_yourbot"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="s-title">Pack title</ZoruLabel>
              <ZoruInput
                id="s-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Cats by Your Bot"
              />
            </div>
            <div>
              <ZoruLabel>Sticker type</ZoruLabel>
              <div className="mt-1 flex items-center gap-2">
                {(['regular', 'mask', 'custom_emoji'] as const).map((t) => (
                  <ZoruButton
                    key={t}
                    type="button"
                    size="sm"
                    variant={stickerType === t ? 'default' : 'outline'}
                    onClick={() => setStickerType(t)}
                  >
                    {t}
                  </ZoruButton>
                ))}
              </div>
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={onCreate}
              disabled={busy || !name.trim() || !title.trim()}
            >
              {busy ? 'Saving…' : 'Save'}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
