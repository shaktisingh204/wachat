'use client';

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SegmentedControl,
  Badge,
  EmptyState,
  IconButton,
} from '@/components/sabcrm/20ui';
import { Bell, BellOff, Trash2, Check, AlertCircle } from 'lucide-react';
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
      <Button variant="outline" iconLeft={Bell} className="relative" onClick={() => setOpen(true)}>
        Configure Alerts
        {unreadCount > 0 && (
          <Badge
            tone="danger"
            kind="solid"
            className="absolute -top-1 -right-1 min-w-[16px] justify-center px-1 text-[10px]"
          >
            {unreadCount}
          </Badge>
        )}
      </Button>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Automated Alerts</DialogTitle>
        </DialogHeader>

        <div className="mb-4">
          <SegmentedControl
            aria-label="Alerts view"
            value={tab}
            onChange={setTab}
            items={[
              {
                value: 'actionable',
                label: unreadCount > 0 ? `Actionable Alerts (${unreadCount})` : 'Actionable Alerts',
              },
              { value: 'config', label: 'Configuration' },
            ]}
          />
        </div>

        {tab === 'actionable' && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {actionable.length === 0 ? (
              <EmptyState
                icon={BellOff}
                title="No recent alerts"
                description="You are all caught up. New alerts will show up here as they fire."
              />
            ) : (
              actionable.map((alert: { id: string; message: string; status: string; timestamp: string }) => (
                <div
                  key={alert.id}
                  className="flex flex-col gap-2 p-3 border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <AlertCircle
                        aria-hidden="true"
                        className={`h-4 w-4 ${alert.status === 'unread' ? 'text-[var(--st-danger)]' : 'text-[var(--st-text-secondary)]'}`}
                      />
                      <span
                        className={`text-sm ${alert.status === 'unread' ? 'font-semibold text-[var(--st-text)]' : 'text-[var(--st-text-secondary)]'}`}
                      >
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
                        iconLeft={Check}
                        onClick={() => markReadMutation.mutate(alert.id)}
                      >
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
                <EmptyState
                  icon={Bell}
                  size="sm"
                  title="No rules configured"
                  description="Add a rule below to get notified when brand metrics cross a threshold."
                />
              ) : (
                <div className="space-y-2">
                  {configs.map((config: AlertConfig) => (
                    <div
                      key={config.id}
                      className="flex items-center justify-between p-2 border border-[var(--st-border)] rounded-[var(--st-radius)]"
                    >
                      <div>
                        <div className="text-sm font-medium text-[var(--st-text)]">{config.name}</div>
                        <div className="text-xs text-[var(--st-text-secondary)] font-mono">{config.condition}</div>
                      </div>
                      <IconButton
                        label={`Delete rule ${config.name}`}
                        icon={Trash2}
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(config.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t border-[var(--st-border)]">
              <h4 className="text-sm font-semibold text-[var(--st-text)]">Add New Rule</h4>
              <Field label="Rule Name">
                <Input
                  placeholder="e.g. Reputation Drop"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </Field>
              <Field label="Condition">
                <Select value={newCondition} onValueChange={setNewCondition}>
                  <SelectTrigger aria-label="Condition">
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sentiment < 50">Sentiment &lt; 50%</SelectItem>
                    <SelectItem value="mentions > 100">Mentions &gt; 100 per day</SelectItem>
                    <SelectItem value="negative_mentions > 10">Negative Mentions &gt; 10 per hour</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Button
                variant="primary"
                block
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
