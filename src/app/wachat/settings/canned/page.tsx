'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  EmptyState,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  Input,
  Switch,
  Label,
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription
} from '@/components/zoruui';
import { useRouter } from 'next/navigation';
import { CircleAlert, TriangleAlert } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { CannedMessagesSettingsTab } from '@/components/zoruui-domain/canned-messages-settings-tab';

import * as React from 'react';
import { useState, useEffect } from 'react';

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
      <ZoruCardHeader>
        <ZoruCardTitle>General Settings</ZoruCardTitle>
        <ZoruCardDescription>Configure global preferences for canned messages.</ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent className="space-y-6">
        
        {/* Sync Feature */}
        <div className="flex items-center justify-between space-x-4">
          <div className="flex flex-col space-y-1">
            <Label htmlFor="sync-projects" className="text-base cursor-pointer">Sync across sub-projects</Label>
            <span className="text-sm text-muted-foreground">
              Automatically share canned messages with all other active sub-projects in your account.
            </span>
          </div>
          <Switch 
            id="sync-projects" 
            checked={syncProjects} 
            onCheckedChange={handleSyncChange} 
          />
        </div>

        {/* Keyboard Trigger Feature */}
        <div className="flex flex-col space-y-3">
          <div className="flex flex-col space-y-1">
            <Label htmlFor="trigger-shortcut" className="text-base">Keyboard Trigger Shortcut</Label>
            <span className="text-sm text-muted-foreground">
              Focus the input below and press the key combination you want to use for opening the canned messages menu. Use Backspace to clear.
            </span>
          </div>
          
          <div className="max-w-md">
            <Input 
              id="trigger-shortcut" 
              placeholder="e.g. Cmd + /" 
              value={trigger}
              onKeyDown={handleKeyDown}
              readOnly
              className="font-mono cursor-pointer focus:ring-2 focus:ring-primary"
            />
          </div>

          {isReserved && (
            <Alert variant="destructive" className="max-w-md mt-2">
              <TriangleAlert className="h-4 w-4" />
              <ZoruAlertTitle>Shortcut Collision Detected</ZoruAlertTitle>
              <ZoruAlertDescription>
                The selected shortcut ({trigger}) conflicts with a native browser or OS shortcut. 
                Please choose a different combination to avoid issues.
              </ZoruAlertDescription>
            </Alert>
          )}
        </div>

      </ZoruCardContent>
    </Card>
  );
}

export default function CannedMessagesPage() {
  const router = useRouter();
  const { activeProject, isLoadingProject } = useProject();

  const breadcrumbs = (
    <Breadcrumb>
      <ZoruBreadcrumbList>
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
        </ZoruBreadcrumbItem>
        <ZoruBreadcrumbSeparator />
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
        </ZoruBreadcrumbItem>
        <ZoruBreadcrumbSeparator />
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbPage>Canned messages</ZoruBreadcrumbPage>
        </ZoruBreadcrumbItem>
      </ZoruBreadcrumbList>
    </Breadcrumb>
  );

  if (isLoadingProject) {
    return (
      <div className="flex min-h-full flex-col gap-6">
        {breadcrumbs}
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="flex min-h-full flex-col gap-6">
        {breadcrumbs}
        <EmptyState
          icon={<CircleAlert className="h-10 w-10" />}
          title="Select a project first"
          description="Pick a project from the WaChat home page to manage canned messages."
          action={<Button onClick={() => router.push('/wachat')}>Choose a project</Button>}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-6">
      {breadcrumbs}

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Canned messages</ZoruPageTitle>
          <ZoruPageDescription>
            Pre-written message snippets your agents can send instantly.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <GeneralCannedSettings />

      <Card>
        <ZoruCardContent>
          <CannedMessagesSettingsTab project={activeProject} />
        </ZoruCardContent>
      </Card>
    </div>
  );
}
