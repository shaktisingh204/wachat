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
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Switch,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import {
  Coins,
  FileCheck,
  Loader2,
  MessageSquare,
  Radio,
  TriangleAlert,
  UserPlus,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  } from '@/app/actions/wachat-features.actions';

import * as React from 'react';

type NotifDef = {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  module: string;
};

const NOTIF_DEFS: NotifDef[] = [
  {
    id: 'new_message',
    label: 'New message',
    description: 'Get notified when a new message arrives.',
    icon: MessageSquare,
    module: 'Chat & Inbox',
  },
  {
    id: 'new_contact',
    label: 'New contact',
    description: 'Get notified when a new contact is added.',
    icon: UserPlus,
    module: 'Chat & Inbox',
  },
  {
    id: 'broadcast_complete',
    label: 'Broadcast complete',
    description: 'Get notified when a broadcast finishes sending.',
    icon: Radio,
    module: 'Campaigns',
  },
  {
    id: 'template_approved',
    label: 'Template approved',
    description: 'Get notified when a template is approved by WhatsApp.',
    icon: FileCheck,
    module: 'Campaigns',
  },
  {
    id: 'system_alerts',
    label: 'System alerts',
    description: 'Critical system notifications and downtime alerts.',
    icon: TriangleAlert,
    module: 'System & Billing',
  },
  {
    id: 'low_credits',
    label: 'Low credits',
    description: 'Alert when your messaging credits are running low.',
    icon: Coins,
    module: 'System & Billing',
  },
];

export default function NotificationPreferencesPage() {
  const { activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProjectId;
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);
  const [isLoading, startTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getNotificationPreferences(projectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      const next: Record<string, boolean> = {};
      for (const def of NOTIF_DEFS) next[def.id] = res.prefs?.[def.id] ?? false;
      setPrefs(next);
    });
  }, [projectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggle = (id: string) => {
    setPrefs((prev) => ({ ...prev, [id]: !prev[id] }));
    setDirty(true);
  };

  const handleSave = () => {
    if (!projectId) return;
    startSaveTransition(async () => {
      const res = await saveNotificationPreferences(projectId, prefs);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setDirty(false);
      toast({ title: 'Saved', description: 'Notification preferences updated.' });
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zoru-ink-muted" />
      </div>
    );
  }

  const groupedDefs = NOTIF_DEFS.reduce((acc, def) => {
    if (!acc[def.module]) acc[def.module] = [];
    acc[def.module].push(def);
    return acc;
  }, {} as Record<string, NotifDef[]>);

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Notification preferences</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Notification preferences</ZoruPageTitle>
            <ZoruPageDescription>
              Control which notifications you receive from Wachat.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </PageHeader>
        <Button size="sm" onClick={handleSave} disabled={!dirty || isSaving}>
          {isSaving ? 'Saving…' : dirty ? 'Save changes' : 'All saved'}
        </Button>
      </div>

      <div className="flex flex-col gap-8">
        {Object.entries(groupedDefs).map(([moduleName, defs]) => (
          <div key={moduleName} className="flex flex-col gap-4">
            <h3 className="text-sm font-medium text-zoru-ink">{moduleName}</h3>
            <Card className="divide-y divide-zoru-line p-0">
              {defs.map((def) => {
                const Icon = def.icon;
                return (
                  <div key={def.id} className="flex items-center gap-4 px-5 py-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2">
                      <Icon className="h-5 w-5 text-zoru-ink-muted" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-zoru-ink">{def.label}</div>
                      <div className="text-[12.5px] text-zoru-ink-muted">{def.description}</div>
                    </div>
                    <Switch
                      checked={!!prefs[def.id]}
                      onCheckedChange={() => toggle(def.id)}
                      aria-label={`Toggle ${def.label}`}
                    />
                  </div>
                );
              })}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
