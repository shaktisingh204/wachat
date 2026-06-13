'use client';

import React, { useState, useTransition } from 'react';
import { SabsmsPageShell } from '@/components/sabsms/page-toolkit';
import { Card, CardHeader, CardTitle, CardDescription, CardBody, Tabs, TabsList, TabsTrigger, TabsContent, Switch, Button, Label, Badge, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';
import { Download, Upload, Save, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  saveNotificationConfigAction,
  type NotificationConfig,
} from './actions';

export function NotificationsClient({ initialConfig }: { initialConfig: NotificationConfig }) {
  const [config, setConfig] = useState<NotificationConfig>(initialConfig);
  const [savedConfig, setSavedConfig] = useState<NotificationConfig>(initialConfig);
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);
  const [isSaving, startSave] = useTransition();

  const dirty = JSON.stringify(config) !== JSON.stringify(savedConfig);

  const breadcrumbs = [
    { label: 'Settings', href: '/sabsms/settings' },
    { label: 'Notifications', href: '/sabsms/settings/notifications' },
  ];

  function persist(next: NotificationConfig, okMsg = 'Notification settings saved') {
    startSave(async () => {
      const res = await saveNotificationConfigAction(next);
      if (res.success) {
        setConfig(res.config);
        setSavedConfig(res.config);
        toast.success(okMsg);
      } else {
        toast.error(res.error || 'Could not save settings');
      }
    });
  }

  const handleToggle = (key: 'muteAll' | 'criticalOnly' | 'aiDailySummary') => {
    setConfig((c) => ({ ...c, [key]: !c[key] }));
  };

  const handleChannelToggle = (idx: number) => {
    setConfig((c) => {
      const channels = c.channels.map((ch, i) =>
        i === idx ? { ...ch, enabled: !ch.enabled } : ch,
      );
      return { ...c, channels };
    });
  };

  const handleEventChannelToggle = (eIdx: number, channelId: string) => {
    setConfig((c) => {
      const events = c.events.map((evt, i) => {
        if (i !== eIdx) return evt;
        const channels = evt.channels.includes(channelId)
          ? evt.channels.filter((id) => id !== channelId)
          : [...evt.channels, channelId];
        return { ...evt, channels };
      });
      return { ...c, events };
    });
  };

  const handleBulkUnsubscribe = () => {
    const next = { ...config, events: config.events.map((e) => ({ ...e, channels: [] })) };
    persist(next, 'All event subscriptions removed');
  };

  const handleRestoreDefaults = () => {
    setConfig(initialConfig);
    toast('Reset to last saved values — click Save to persist');
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sabsms-notifications-config.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Configuration exported');
  };

  const triggerInputImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        try {
          const data = JSON.parse(re.target?.result as string) as NotificationConfig;
          // Persist the imported config so it actually takes effect.
          persist(data, 'Configuration imported and saved');
        } catch {
          toast.error('Invalid JSON configuration file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <SabsmsPageShell title="Notifications" breadcrumbs={breadcrumbs}>
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Top-level actions */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notification Settings</h1>
            <p className="text-[var(--st-text-secondary)]">Manage how and when your workspace receives alerts. Changes are saved to your workspace.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportConfig}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={triggerInputImport} disabled={isSaving}>
              <Upload className="mr-2 h-4 w-4" /> Import
            </Button>
            <Button size="sm" onClick={() => persist(config)} disabled={!dirty || isSaving}>
              <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="channels">Channels</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Global Toggles</CardTitle>
                </CardHeader>
                <CardBody className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Mute All Notifications</Label>
                      <p className="text-sm text-[var(--st-text-secondary)]">Temporarily pause all alerts.</p>
                    </div>
                    <Switch checked={config.muteAll} onCheckedChange={() => handleToggle('muteAll')} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Critical-Only Mode</Label>
                      <p className="text-sm text-[var(--st-text-secondary)]">Only receive high-severity alerts.</p>
                    </div>
                    <Switch checked={config.criticalOnly} onCheckedChange={() => handleToggle('criticalOnly')} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>AI Daily Summary</Label>
                      <p className="text-sm text-[var(--st-text-secondary)]">Opt-in to daily AI-generated digests.</p>
                    </div>
                    <Switch checked={config.aiDailySummary} onCheckedChange={() => handleToggle('aiDailySummary')} />
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Delivery Preferences</CardTitle>
                </CardHeader>
                <CardBody className="space-y-6">
                  <div className="space-y-2">
                    <Label>Digest Mode</Label>
                    <Select value={config.digestMode} onValueChange={(val) => setConfig((c) => ({ ...c, digestMode: val }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Immediate Delivery</SelectItem>
                        <SelectItem value="hourly">Hourly Digest</SelectItem>
                        <SelectItem value="daily">Daily Digest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="pt-4 border-t space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Alert Debouncing (Anti-Fatigue)</Label>
                        <p className="text-sm text-[var(--st-text-secondary)]">Summarize repeating alerts (e.g., &quot;15 errors in 1 hour&quot;).</p>
                      </div>
                      <Switch
                        checked={config.debouncing.enabled}
                        onCheckedChange={(val) => setConfig((c) => ({ ...c, debouncing: { ...c.debouncing, enabled: val } }))}
                      />
                    </div>
                    {config.debouncing.enabled && (
                      <div className="flex gap-2 items-center text-sm">
                        <span>Window (mins):</span>
                        <Input type="number" min={1} value={config.debouncing.windowMinutes} onChange={(e) => setConfig((c) => ({ ...c, debouncing: { ...c.debouncing, windowMinutes: parseInt(e.target.value) || 60 } }))} className="w-24" />
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Quiet Hours</Label>
                        <p className="text-sm text-[var(--st-text-secondary)]">Pause non-critical alerts during this window.</p>
                      </div>
                      <Switch
                        checked={config.quietHours.enabled}
                        onCheckedChange={(val) => setConfig((c) => ({ ...c, quietHours: { ...c.quietHours, enabled: val } }))}
                      />
                    </div>
                    {config.quietHours.enabled && (
                      <div className="flex gap-2 items-center text-sm">
                        <Input type="time" value={config.quietHours.start} onChange={(e) => setConfig((c) => ({ ...c, quietHours: { ...c.quietHours, start: e.target.value } }))} className="w-auto" />
                        <span>to</span>
                        <Input type="time" value={config.quietHours.end} onChange={(e) => setConfig((c) => ({ ...c, quietHours: { ...c.quietHours, end: e.target.value } }))} className="w-auto" />
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="subscriptions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Event Subscriptions</CardTitle>
                <CardDescription>Map system events to specific notification channels.</CardDescription>
              </CardHeader>
              <CardBody className="p-0">
                <div className="divide-y border rounded-md">
                  {config.events.map((evt, i) => (
                    <div key={evt.id} className="bg-[var(--st-bg-secondary)] flex flex-col border-b last:border-b-0">
                      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{evt.name}</span>
                            {evt.critical && <Badge variant="destructive" className="h-5 text-[10px]">Critical</Badge>}
                            {evt.threshold && <Badge variant="secondary" className="h-5 text-[10px]">Threshold: {evt.threshold}</Badge>}
                            {evt.debounceMinutes > 0 && <Badge variant="outline" className="h-5 text-[10px]">Debounced: {evt.debounceMinutes}m</Badge>}
                          </div>
                          <p className="text-xs text-[var(--st-text-secondary)] mt-1 font-mono">{evt.id}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          {config.channels.filter((c) => c.enabled).map((ch) => {
                            const isActive = evt.channels.includes(ch.id);
                            return (
                              <Badge
                                key={ch.id}
                                variant={isActive ? 'default' : 'outline'}
                                className="cursor-pointer transition-colors"
                                onClick={() => handleEventChannelToggle(i, ch.id)}
                              >
                                {ch.name}
                              </Badge>
                            );
                          })}
                          <Button variant="ghost" size="icon" className="h-8 w-8 ml-2" onClick={() => setExpandedEvent(expandedEvent === i ? null : i)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {expandedEvent === i && (
                        <div className="px-4 pb-4 pt-2 border-t bg-[var(--st-bg-muted)]/20 space-y-4">
                          <div className="space-y-1">
                            <Label className="text-sm">Event-Specific Debouncing</Label>
                            <p className="text-xs text-[var(--st-text-secondary)]">Summarize multiple occurrences of this event into a single notification.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">Window (mins):</span>
                            <Input
                              type="number"
                              min={0}
                              value={evt.debounceMinutes}
                              onChange={(e) => {
                                const minutes = parseInt(e.target.value) || 0;
                                setConfig((c) => ({
                                  ...c,
                                  events: c.events.map((ev, idx) => (idx === i ? { ...ev, debounceMinutes: minutes } : ev)),
                                }));
                              }}
                              className="w-24 h-8 text-sm"
                            />
                            <span className="text-xs text-[var(--st-text-secondary)] ml-2">(Set to 0 to disable)</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </TabsContent>

          <TabsContent value="channels" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {config.channels.map((ch, i) => (
                <Card key={ch.id} className="flex flex-col">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      {ch.name}
                    </CardTitle>
                    <Switch checked={ch.enabled} onCheckedChange={() => handleChannelToggle(i)} />
                  </CardHeader>
                  <CardBody className="flex-1 pb-2 space-y-4">
                    <p className="text-xs text-[var(--st-text-secondary)] capitalize">
                      Type: {ch.type}
                    </p>
                    {(ch.type === 'slack' || ch.type === 'discord') && (
                      <div className="space-y-2">
                        <Label className="text-xs">Webhook URL</Label>
                        <Input
                          type="url"
                          placeholder="https://..."
                          value={ch.webhookUrl || ''}
                          onChange={(e) => {
                            setConfig((c) => ({
                              ...c,
                              channels: c.channels.map((channel, idx) => (idx === i ? { ...channel, webhookUrl: e.target.value } : channel)),
                            }));
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6">
            <Card className="border-destructive/20">
              <CardHeader>
                <CardTitle className="text-base text-[var(--st-text)]">Danger Zone</CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Bulk Unsubscribe</p>
                    <p className="text-xs text-[var(--st-text-secondary)]">Remove all active event subscriptions and save.</p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={handleBulkUnsubscribe} disabled={isSaving}>Unsubscribe</Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Reset Unsaved Changes</p>
                    <p className="text-xs text-[var(--st-text-secondary)]">Discard edits and revert to the last saved configuration.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleRestoreDefaults}>Reset</Button>
                </div>
              </CardBody>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </SabsmsPageShell>
  );
}
