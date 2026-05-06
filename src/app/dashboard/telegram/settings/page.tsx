'use client';

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Bot, Save, Settings } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  listTelegramBots,
  setTelegramMenuButton,
  updateTelegramBotProfile,
  type TelegramBotListRow,
} from '@/app/actions/telegram.actions';

import {
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

export default function TelegramSettingsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';
  const { toast } = useZoruToast();

  const [bots, setBots] = useState<TelegramBotListRow[]>([]);
  const [botId, setBotId] = useState<string>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [miniAppUrl, setMiniAppUrl] = useState('');

  const [menuType, setMenuType] = useState<'default' | 'commands' | 'web_app'>('commands');
  const [menuText, setMenuText] = useState('');
  const [menuUrl, setMenuUrl] = useState('');

  const [busy, startBusy] = useTransition();

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const list = await listTelegramBots(projectId);
      setBots(list);
      if (!botId && list.length > 0) {
        const b = list[0];
        setBotId(b._id);
        setName(b.name ?? '');
      }
    })();
  }, [projectId, botId]);

  useEffect(() => {
    if (!botId) return;
    const b = bots.find((x) => x._id === botId);
    if (b) setName(b.name ?? '');
  }, [botId, bots]);

  const onSaveProfile = () => {
    if (!botId) return;
    startBusy(async () => {
      const res = await updateTelegramBotProfile({
        botId,
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        shortDescription: shortDescription.trim() || undefined,
        miniAppUrl: miniAppUrl.trim() || undefined,
      });
      if (!res.success) {
        toast({
          title: 'Update failed',
          description: res.error ?? 'Unknown',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Profile saved' });
    });
  };

  const onSaveMenu = () => {
    if (!botId) return;
    startBusy(async () => {
      const button =
        menuType === 'web_app'
          ? { type: 'web_app' as const, text: menuText, url: menuUrl }
          : ({ type: menuType } as { type: 'default' | 'commands' });
      const res = await setTelegramMenuButton({ botId, menuButton: button });
      if (!res.success) {
        toast({
          title: 'Menu update failed',
          description: res.error ?? 'Unknown',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Menu button saved' });
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState
          icon={<Settings />}
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
            <Settings className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[22px] leading-tight text-zoru-ink">Bot settings</h1>
            <p className="mt-1 text-[13.5px] text-zoru-ink-muted">
              Profile + menu button. Backed by <code>telegram-bot-profile</code>.
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
        <p className="text-sm text-zoru-ink">Profile</p>
        <div>
          <ZoruLabel htmlFor="s-name">Display name</ZoruLabel>
          <ZoruInput id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <ZoruLabel htmlFor="s-short">Short description (max 120)</ZoruLabel>
          <ZoruInput
            id="s-short"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
          />
        </div>
        <div>
          <ZoruLabel htmlFor="s-desc">Description (max 512)</ZoruLabel>
          <ZoruTextarea
            id="s-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <ZoruLabel htmlFor="s-mini">Mini App URL</ZoruLabel>
          <ZoruInput
            id="s-mini"
            value={miniAppUrl}
            onChange={(e) => setMiniAppUrl(e.target.value)}
            placeholder="https://app.example.com"
          />
        </div>
        <footer className="flex justify-end border-t border-zoru-line pt-3">
          <ZoruButton onClick={onSaveProfile} disabled={busy}>
            <Save className="mr-2 h-4 w-4" />
            {busy ? 'Saving…' : 'Save profile'}
          </ZoruButton>
        </footer>
      </ZoruCard>

      <ZoruCard className="flex flex-col gap-3 p-5">
        <p className="text-sm text-zoru-ink">Menu button</p>
        <div className="flex items-center gap-2">
          {(['default', 'commands', 'web_app'] as const).map((t) => (
            <ZoruButton
              key={t}
              type="button"
              size="sm"
              variant={menuType === t ? 'default' : 'outline'}
              onClick={() => setMenuType(t)}
            >
              {t}
            </ZoruButton>
          ))}
        </div>
        {menuType === 'web_app' && (
          <>
            <div>
              <ZoruLabel htmlFor="m-text">Button text</ZoruLabel>
              <ZoruInput
                id="m-text"
                value={menuText}
                onChange={(e) => setMenuText(e.target.value)}
                placeholder="Open app"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="m-url">Web app URL</ZoruLabel>
              <ZoruInput
                id="m-url"
                value={menuUrl}
                onChange={(e) => setMenuUrl(e.target.value)}
                placeholder="https://app.example.com"
              />
            </div>
          </>
        )}
        <footer className="flex justify-end border-t border-zoru-line pt-3">
          <ZoruButton onClick={onSaveMenu} disabled={busy}>
            <Save className="mr-2 h-4 w-4" />
            {busy ? 'Saving…' : 'Save menu button'}
          </ZoruButton>
        </footer>
      </ZoruCard>
    </div>
  );
}
