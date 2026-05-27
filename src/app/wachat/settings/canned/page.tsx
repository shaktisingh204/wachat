'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CircleAlert,
  Info,
  Keyboard,
  MessageSquareQuote,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';

import {
  Input,
  Switch,
  Label,
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
} from '@/components/zoruui';
import { useProject } from '@/context/project-context';
import { CannedMessagesSettingsTab } from '@/components/zoruui-domain/canned-messages-settings-tab';
import { WaPage, PageHeader, Section, EmptyState, WaButton, MetricTile, StatusPill } from '@/components/wachat-ui';

const RESERVED_SHORTCUTS = [
  'cmd + c', 'cmd + v', 'cmd + x', 'cmd + z', 'cmd + y', 'cmd + a', 'cmd + f', 'cmd + p', 'cmd + s', 'cmd + r', 'cmd + t', 'cmd + w', 'cmd + n',
  'ctrl + c', 'ctrl + v', 'ctrl + x', 'ctrl + z', 'ctrl + y', 'ctrl + a', 'ctrl + f', 'ctrl + p', 'ctrl + s', 'ctrl + r', 'ctrl + t', 'ctrl + w', 'ctrl + n',
  'alt + f4', 'alt + tab', 'cmd + tab',
  'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
  'cmd + shift + t', 'cmd + shift + w', 'cmd + shift + n',
  'ctrl + shift + t', 'ctrl + shift + w', 'ctrl + shift + n',
  'cmd + arrowleft', 'cmd + arrowright', 'alt + arrowleft', 'alt + arrowright',
];

function GeneralCannedSettings() {
  const [syncProjects, setSyncProjects] = useState(false);
  const [trigger, setTrigger] = useState('');
  const [isReserved, setIsReserved] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const savedSync = localStorage.getItem('wachat_sync_canned_projects') === 'true';
    const savedTrigger = localStorage.getItem('wachat_canned_trigger') || 'Cmd + /';
    setSyncProjects(savedSync);
    setTrigger(savedTrigger);
    checkCollision(savedTrigger);
  }, []);

  const checkCollision = (shortcut: string) => {
    if (!shortcut) return setIsReserved(false);
    setIsReserved(RESERVED_SHORTCUTS.includes(shortcut.toLowerCase()));
  };

  const handleSyncChange = (checked: boolean) => {
    setSyncProjects(checked);
    localStorage.setItem('wachat_sync_canned_projects', checked.toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.key === 'Backspace' || e.key === 'Delete') {
      setTrigger('');
      checkCollision('');
      localStorage.setItem('wachat_canned_trigger', '');
      return;
    }
    if (['Control', 'Meta', 'Alt', 'Shift', 'CapsLock', 'Tab'].includes(e.key)) return;

    const keys: string[] = [];
    if (e.metaKey) keys.push('Cmd');
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');
    const keyName = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
    keys.push(keyName);
    const shortcut = keys.join(' + ');
    setTrigger(shortcut);
    checkCollision(shortcut);
    localStorage.setItem('wachat_canned_trigger', shortcut);
  };

  if (!isMounted) {
    return <div className="h-[260px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />;
  }

  return (
    <Section title="General settings" description="Configure global preferences for canned messages.">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="sync-projects" className="cursor-pointer text-[13.5px] font-semibold text-zinc-900">
              Sync across sub-projects
            </Label>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              Automatically share canned messages with all other active sub-projects in your account.
            </p>
          </div>
          <Switch id="sync-projects" checked={syncProjects} onCheckedChange={handleSyncChange} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="trigger-shortcut" className="text-[13.5px] font-semibold text-zinc-900">
            Keyboard trigger
          </Label>
          <p className="text-[12px] leading-relaxed text-zinc-500">
            Focus the input and press the key combination you want to use for opening the canned messages menu. Backspace clears.
          </p>
          <div className="max-w-md">
            <Input
              id="trigger-shortcut"
              placeholder="e.g. Cmd + /"
              value={trigger}
              onKeyDown={handleKeyDown}
              readOnly
              className="rounded-xl font-mono"
            />
          </div>

          {isReserved && (
            <Alert variant="destructive" className="mt-2 max-w-md rounded-xl">
              <TriangleAlert className="h-4 w-4" />
              <ZoruAlertTitle>Shortcut collision</ZoruAlertTitle>
              <ZoruAlertDescription>
                The selected shortcut ({trigger}) conflicts with a native browser or OS shortcut. Pick a different combination.
              </ZoruAlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </Section>
  );
}

function CannedHeaderKpis() {
  const [trigger, setTrigger] = useState<string>('');
  const [sync, setSync] = useState<boolean>(false);
  useEffect(() => {
    setTrigger(localStorage.getItem('wachat_canned_trigger') || 'Cmd + /');
    setSync(localStorage.getItem('wachat_sync_canned_projects') === 'true');
  }, []);

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <MetricTile
        label="Trigger shortcut"
        value={<span className="font-mono text-[13px]">{trigger || 'Not set'}</span>}
        icon={Keyboard}
        delay={0.02}
      />
      <MetricTile
        label="Project sync"
        value={<span className="text-[15px]">{sync ? 'On' : 'Off'}</span>}
        icon={RefreshCw}
        delay={0.04}
      />
      <MetricTile
        label="Status"
        value={<span className="text-[15px]">Legacy</span>}
        icon={Info}
        delay={0.06}
      />
    </section>
  );
}

export default function CannedMessagesPage() {
  const router = useRouter();
  const { activeProject, isLoadingProject } = useProject();

  if (isLoadingProject) {
    return (
      <WaPage>
        <PageHeader
          title="Canned messages"
          description="Pre-written message snippets your agents can send instantly."
          kicker="Wachat · settings"
          backHref="/wachat"
          eyebrowIcon={MessageSquareQuote}
        />
        <div className="h-[420px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
      </WaPage>
    );
  }

  if (!activeProject) {
    return (
      <WaPage>
        <PageHeader
          title="Canned messages"
          description="Pre-written message snippets your agents can send instantly."
          kicker="Wachat · settings"
          backHref="/wachat"
          eyebrowIcon={MessageSquareQuote}
        />
        <EmptyState
          icon={CircleAlert}
          title="Select a project first"
          description="Pick a project from the Wachat home page to manage canned messages."
          action={<WaButton onClick={() => router.push('/wachat')}>Choose a project</WaButton>}
        />
      </WaPage>
    );
  }

  return (
    <WaPage>
      <PageHeader
        title="Canned messages"
        description="Pre-written message snippets your agents can send instantly."
        kicker="Wachat · settings"
        backHref="/wachat"
        eyebrowIcon={MessageSquareQuote}
        actions={
          <WaButton variant="outline" size="sm" href="/wachat/saved-replies" rightIcon={ArrowRight}>
            Open saved replies
          </WaButton>
        }
      />

      <div className="space-y-4">
        {/* Soft deprecation banner — points users toward Saved Replies. */}
        <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100">
            <Info className="h-4 w-4 text-amber-700" strokeWidth={2.25} />
          </span>
          <div className="flex-1">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-amber-900">
              Canned messages are moving to Saved replies
              <StatusPill tone="paused">Legacy</StatusPill>
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-amber-800">
              Saved replies adds rich-media, variables, and shared folders. Existing canned shortcuts continue to work and will migrate automatically.
            </p>
          </div>
          <WaButton href="/wachat/saved-replies" size="sm" rightIcon={ArrowRight}>
            Try saved replies
          </WaButton>
        </div>

        <CannedHeaderKpis />

        <GeneralCannedSettings />

        <Section title="Snippet library" description="Manage shortcuts, content, and visibility for each canned message.">
          <CannedMessagesSettingsTab project={activeProject} />
        </Section>
      </div>
    </WaPage>
  );
}
