'use client';

import React, { useState } from 'react';
import { SabsmsPageShell } from '@/components/sabsms/page-toolkit';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Bell, CheckCircle2, Download, Upload, Trash2, 
  RefreshCcw, Search, MessageSquare, Mail, Slack, 
  Smartphone, Activity, Globe, Edit2, Play, AlertTriangle 
} from 'lucide-react';
import { toast } from 'sonner';

export function NotificationsClient({ initialConfig }: { initialConfig: any }) {
  const [config, setConfig] = useState(initialConfig);

  const breadcrumbs = [
    { label: 'Settings', href: '/sabsms/settings' },
    { label: 'Notifications', href: '/sabsms/settings/notifications', isActive: true },
  ];

  const handleToggle = (key: string) => {
    setConfig({ ...config, [key]: !config[key] });
    toast.success('Configuration updated');
  };

  const handleChannelToggle = (idx: number) => {
    const newChannels = [...config.channels];
    newChannels[idx].enabled = !newChannels[idx].enabled;
    setConfig({ ...config, channels: newChannels });
    toast.success(`${newChannels[idx].name} channel updated`);
  };

  const handleEventChannelToggle = (eIdx: number, channelId: string) => {
    const newEvents = [...config.events];
    const event = newEvents[eIdx];
    if (event.channels.includes(channelId)) {
      event.channels = event.channels.filter((id: string) => id !== channelId);
    } else {
      event.channels.push(channelId);
    }
    setConfig({ ...config, events: newEvents });
    toast.success('Event subscription updated');
  };

  const handleTestSend = (channelName: string) => {
    toast.success(`Test notification sent via ${channelName}`);
  };

  const handleBulkUnsubscribe = () => {
    const newEvents = config.events.map((e: any) => ({ ...e, channels: [] }));
    setConfig({ ...config, events: newEvents });
    toast.success('Bulk unsubscribe complete');
  };

  const handleRestoreDefaults = () => {
    setConfig(initialConfig);
    toast.success('Restored to default configuration');
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sabsms-notifications-config.json';
    a.click();
    toast.success('Configuration exported successfully');
  };

  const triggerInputImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          try {
            const data = JSON.parse(re.target?.result as string);
            setConfig(data);
            toast.success('Configuration imported successfully');
          } catch (err) {
            toast.error('Invalid JSON configuration file');
          }
        };
        reader.readAsText(file);
      }
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
            <p className="text-muted-foreground">Manage how and when your workspace receives alerts.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportConfig}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={triggerInputImport}>
              <Upload className="mr-2 h-4 w-4" /> Import
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
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Mute All Notifications</Label>
                      <p className="text-sm text-muted-foreground">Temporarily pause all alerts.</p>
                    </div>
                    <Switch checked={config.muteAll} onCheckedChange={() => handleToggle('muteAll')} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Critical-Only Mode</Label>
                      <p className="text-sm text-muted-foreground">Only receive high-severity alerts.</p>
                    </div>
                    <Switch checked={config.criticalOnly} onCheckedChange={() => handleToggle('criticalOnly')} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>AI Daily Summary</Label>
                      <p className="text-sm text-muted-foreground">Opt-in to daily AI-generated digests.</p>
                    </div>
                    <Switch checked={config.aiDailySummary} onCheckedChange={() => handleToggle('aiDailySummary')} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Delivery Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Digest Mode</Label>
                    <Select value={config.digestMode} onValueChange={(val) => setConfig({...config, digestMode: val})}>
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
                        <Label>Quiet Hours</Label>
                        <p className="text-sm text-muted-foreground">Pause non-critical alerts during this window.</p>
                      </div>
                      <Switch 
                        checked={config.quietHours.enabled} 
                        onCheckedChange={(val) => setConfig({...config, quietHours: {...config.quietHours, enabled: val}})} 
                      />
                    </div>
                    {config.quietHours.enabled && (
                      <div className="flex gap-2 items-center text-sm">
                        <Input type="time" value={config.quietHours.start} onChange={(e) => setConfig({...config, quietHours: {...config.quietHours, start: e.target.value}})} className="w-auto" />
                        <span>to</span>
                        <Input type="time" value={config.quietHours.end} onChange={(e) => setConfig({...config, quietHours: {...config.quietHours, end: e.target.value}})} className="w-auto" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="subscriptions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Event Subscriptions</CardTitle>
                <CardDescription>Map system events to specific notification channels.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y border rounded-md">
                  {config.events.map((evt: any, i: number) => (
                    <div key={evt.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{evt.name}</span>
                          {evt.critical && <Badge variant="destructive" className="h-5 text-[10px]">Critical</Badge>}
                          {evt.threshold && <Badge variant="secondary" className="h-5 text-[10px]">Threshold: {evt.threshold}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">{evt.id}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        {config.channels.filter((c: any) => c.enabled).map((ch: any) => {
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 ml-2">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="channels" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {config.channels.map((ch: any, i: number) => (
                <Card key={ch.id} className="flex flex-col">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      {ch.name}
                    </CardTitle>
                    <Switch checked={ch.enabled} onCheckedChange={() => handleChannelToggle(i)} />
                  </CardHeader>
                  <CardContent className="flex-1 pb-2 space-y-4">
                    <p className="text-xs text-muted-foreground capitalize">
                      Type: {ch.type}
                    </p>
                    {ch.type === 'webhook' && (
                      <div className="space-y-2">
                        <Label className="text-xs">Signing Secret</Label>
                        <div className="flex items-center gap-2">
                          <Input type="password" value={ch.secret} readOnly className="h-8 text-xs font-mono" />
                          <Button variant="outline" size="sm" className="h-8 shrink-0">Rotate</Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button variant="secondary" size="sm" className="w-full" onClick={() => handleTestSend(ch.name)} disabled={!ch.enabled}>
                      <Play className="mr-2 h-3 w-3" /> Test Send
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recipient Overrides</CardTitle>
                <CardDescription>Individual team members who have overridden defaults.</CardDescription>
              </CardHeader>
              <CardContent>
                {config.recipientOverrides.length > 0 ? (
                  <div className="divide-y border rounded-md">
                    {config.recipientOverrides.map((ro: any, idx: number) => (
                      <div key={idx} className="p-3 text-sm flex items-center justify-between bg-card">
                        <div>
                          <span className="font-medium">{ro.userId}</span> overridden <span className="font-mono text-muted-foreground">{ro.eventId}</span>
                        </div>
                        <Badge variant="outline">{ro.mute ? 'Muted' : 'Custom'}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No active overrides.</p>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-destructive/20">
                <CardHeader>
                  <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Bulk Unsubscribe</p>
                      <p className="text-xs text-muted-foreground">Remove all active event subscriptions.</p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={handleBulkUnsubscribe}>Unsubscribe</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Restore Defaults</p>
                      <p className="text-xs text-muted-foreground">Reset configuration to factory settings.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleRestoreDefaults}>Restore</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Audit Trail</CardTitle>
                  <CardDescription>Recent changes to notification configuration.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Edit2 className="h-3 w-3" />
                      </div>
                      <div>
                        <p className="text-sm">Admin disabled Slack channel</p>
                        <p className="text-xs text-muted-foreground">2 hours ago</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Globe className="h-3 w-3" />
                      </div>
                      <div>
                        <p className="text-sm">Webhook secret rotated</p>
                        <p className="text-xs text-muted-foreground">Yesterday</p>
                      </div>
                    </div>
                    <Button variant="link" size="sm" className="px-0">View full audit log &rarr;</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </SabsmsPageShell>
  );
}
