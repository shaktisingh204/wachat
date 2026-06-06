'use client';

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
} from '@/components/sabcrm/20ui/compat';
import { Bell, BellRing, Trash2, Check, AlertCircle } from 'lucide-react';
import { saveAlertConfig, deleteAlertConfig, markAlertRead } from './actions';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAlertConfigs, getActionableAlerts, type AlertConfig } from './actions';

export function AlertsDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'config' | 'actionable'>('actionable');
  
  const queryClient = useQueryClient();

  const { data: configs = [], refetch: refetchConfigs } = useQuery({
    queryKey: ['brand-alert-configs', projectId],
    queryFn: () => getAlertConfigs(projectId),
    enabled: open,
  });

  const { data: actionable = [], refetch: refetchActionable } = useQuery({
    queryKey: ['brand-actionable-alerts', projectId],
    queryFn: () => getActionableAlerts(projectId),
    enabled: open,
  });

  const unreadCount = actionable.filter((a: { status: string }) => a.status === 'unread').length;

  const [newName, setNewName] = useState('');
  const [newCondition, setNewCondition] = useState('sentiment < 50');

  const addMutation = useMutation({
    mutationFn: (config: AlertConfig) => saveAlertConfig(projectId, config),
    onSuccess: () => {
      setNewName('');
      refetchConfigs();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAlertConfig(projectId, id),
    onSuccess: () => refetchConfigs(),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markAlertRead(projectId, id),
    onSuccess: () => {
      refetchActionable();
      queryClient.invalidateQueries({ queryKey: ['brand-actionable-alerts', projectId] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="relative">
          <Bell className="mr-2 h-4 w-4" />
          Configure Alerts
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--st-danger)] text-[10px] text-white">
              {unreadCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Automated Alerts</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 border-b border-[var(--st-border)] pb-2 mb-4">
          <button
            className={`text-sm font-medium ${tab === 'actionable' ? 'text-[var(--st-text)]' : 'text-[var(--st-text-secondary)]'}`}
            onClick={() => setTab('actionable')}
          >
            Actionable Alerts {unreadCount > 0 && `(${unreadCount})`}
          </button>
          <button
            className={`text-sm font-medium ${tab === 'config' ? 'text-[var(--st-text)]' : 'text-[var(--st-text-secondary)]'}`}
            onClick={() => setTab('config')}
          >
            Configuration
          </button>
        </div>

        {tab === 'actionable' && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {actionable.length === 0 ? (
              <div className="text-center text-sm text-[var(--st-text-secondary)] py-8">No recent alerts.</div>
            ) : (
              actionable.map((alert: { id: string; message: string; status: string; timestamp: string }) => (
                <div key={alert.id} className="flex flex-col gap-2 p-3 border border-[var(--st-border)] rounded-md bg-[var(--st-bg-muted)]">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <AlertCircle className={`h-4 w-4 ${alert.status === 'unread' ? 'text-[var(--st-danger)]' : 'text-[var(--st-text-secondary)]'}`} />
                      <span className={`text-sm ${alert.status === 'unread' ? 'font-semibold text-[var(--st-text)]' : 'text-[var(--st-text-secondary)]'}`}>
                        {alert.message}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-[var(--st-text-secondary)]">
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                    {alert.status === 'unread' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => markReadMutation.mutate(alert.id)}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Acknowledge
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'config' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-[var(--st-text)]">Active Rules</h4>
              {configs.length === 0 ? (
                <div className="text-xs text-[var(--st-text-secondary)]">No rules configured.</div>
              ) : (
                <div className="space-y-2">
                  {configs.map((config: AlertConfig) => (
                    <div key={config.id} className="flex items-center justify-between p-2 border border-[var(--st-border)] rounded-md">
                      <div>
                        <div className="text-sm font-medium">{config.name}</div>
                        <div className="text-xs text-[var(--st-text-secondary)] font-mono">{config.condition}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(config.id)}
                      >
                        <Trash2 className="h-4 w-4 text-[var(--st-danger)]" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t border-[var(--st-border)]">
              <h4 className="text-sm font-semibold text-[var(--st-text)]">Add New Rule</h4>
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input
                  placeholder="e.g. Reputation Drop"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={newCondition} onValueChange={setNewCondition}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sentiment < 50">Sentiment &lt; 50%</SelectItem>
                    <SelectItem value="mentions > 100">Mentions &gt; 100 per day</SelectItem>
                    <SelectItem value="negative_mentions > 10">Negative Mentions &gt; 10 per hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                disabled={!newName || addMutation.isPending}
                onClick={() => addMutation.mutate({ name: newName, condition: newCondition, active: true })}
              >
                Create Alert Rule
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
