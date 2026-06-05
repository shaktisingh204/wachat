'use client';

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  EmptyState,
  Skeleton,
  Field,
  Input,
  Switch,
  Alert,
} from '@/components/sabcrm/20ui';
import { useRouter } from 'next/navigation';
import { CircleAlert } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { CannedMessagesSettingsTab } from '@/components/zoruui-domain/canned-messages-settings-tab';

import WachatPage from '@/app/wachat/_components/wachat-page';

import * as React from 'react';
import { useState, useEffect } from 'react';

const BREADCRUMB = [
  { label: 'SabNode', href: '/dashboard' },
  { label: 'WaChat', href: '/wachat' },
  { label: 'Canned messages' },
];

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
    if (!shortcut) {
      setIsReserved(false);
      return;
    }
    const isCollision = RESERVED_SHORTCUTS.includes(shortcut.toLowerCase());
    setIsReserved(isCollision);
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

    if (['Control', 'Meta', 'Alt', 'Shift', 'CapsLock', 'Tab'].includes(e.key)) {
        return;
    }

    const keys = [];
    if (e.metaKey) keys.push('Cmd');
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');

    const keyName = e.key === ' ' ? 'Space' : (e.key.length === 1 ? e.key.toUpperCase() : e.key);
    keys.push(keyName);

    const shortcut = keys.join(' + ');
    setTrigger(shortcut);
    checkCollision(shortcut);
    localStorage.setItem('wachat_canned_trigger', shortcut);
  };

  if (!isMounted) return <Skeleton className="h-[250px] w-full mb-6" />;

  return (
    <Card className="mb-2">
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
        <CardDescription>Configure global preferences for canned messages.</CardDescription>
      </CardHeader>
      <CardBody className="space-y-6">

        {/* Sync Feature */}
        <div className="flex items-center justify-between space-x-4">
          <Field
            id="sync-projects"
            label="Sync across sub-projects"
            help="Automatically share canned messages with all other active sub-projects in your account."
            className="flex-1"
          >
            {null}
          </Field>
          <Switch
            id="sync-projects"
            checked={syncProjects}
            onCheckedChange={handleSyncChange}
            aria-label="Sync across sub-projects"
          />
        </div>

        {/* Keyboard Trigger Feature */}
        <div className="flex flex-col space-y-3">
          <div className="max-w-md">
            <Field
              id="trigger-shortcut"
              label="Keyboard Trigger Shortcut"
              help="Focus the input below and press the key combination you want to use for opening the canned messages menu. Use Backspace to clear."
            >
              <Input
                placeholder="e.g. Cmd + /"
                value={trigger}
                onKeyDown={handleKeyDown}
                readOnly
                className="font-mono cursor-pointer"
              />
            </Field>
          </div>

          {isReserved && (
            <Alert tone="danger" title="Shortcut Collision Detected" className="max-w-md mt-2">
              The selected shortcut ({trigger}) conflicts with a native browser or OS shortcut.
              Please choose a different combination to avoid issues.
            </Alert>
          )}
        </div>

      </CardBody>
    </Card>
  );
}

export default function CannedMessagesPage() {
  const router = useRouter();
  const { activeProject, isLoadingProject } = useProject();

  if (isLoadingProject) {
    return (
      <WachatPage breadcrumb={BREADCRUMB} width="narrow">
        <Skeleton className="h-[420px] w-full" />
      </WachatPage>
    );
  }

  if (!activeProject) {
    return (
      <WachatPage breadcrumb={BREADCRUMB} width="narrow">
        <EmptyState
          icon={CircleAlert}
          title="Select a project first"
          description="Pick a project from the WaChat home page to manage canned messages."
          action={<Button onClick={() => router.push('/wachat')}>Choose a project</Button>}
        />
      </WachatPage>
    );
  }

  return (
    <WachatPage
      breadcrumb={BREADCRUMB}
      width="narrow"
      title="Canned messages"
      description="Pre-written message snippets your agents can send instantly."
    >
      <GeneralCannedSettings />

      <Card>
        <CardBody>
          <CannedMessagesSettingsTab project={activeProject} />
        </CardBody>
      </Card>
    </WachatPage>
  );
}
