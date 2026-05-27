'use client';

import { useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, Network, Pencil, Send, Trash2 } from 'lucide-react';
import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Badge,
  Button,
  Card,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  EmptyState,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  zoruToast,
} from '@/components/zoruui';
import {
  actionDeleteEmailWebhook,
  actionTestEmailWebhook,
  type EmailWebhookDoc,
} from '@/app/actions/email/integrations.actions';

interface WebhookTableProps {
  webhooks: EmailWebhookDoc[];
  onEdit: (w: EmailWebhookDoc) => void;
  onChanged: () => void;
}

export function WebhookTable({ webhooks, onEdit, onChanged }: WebhookTableProps) {
  const [pending, startTransition] = useTransition();

  if (webhooks.length === 0) {
    return (
      <EmptyState
        icon={<Network />}
        title="No webhooks yet"
        description="Subscribe an external endpoint to receive realtime delivery events."
      />
    );
  }

  const handleTest = (id: string) => {
    startTransition(async () => {
      const result = await actionTestEmailWebhook(id);
      if (!result.ok) {
        zoruToast({ title: 'Test failed', description: result.error, variant: 'destructive' });
        return;
      }
      const { status, durationMs, error } = result.data;
      if (error) {
        zoruToast({ title: `Test errored (${status})`, description: error, variant: 'destructive' });
      } else if (status >= 200 && status < 300) {
        zoruToast({ title: `OK ${status} · ${durationMs}ms` });
      } else {
        zoruToast({
          title: `Non-2xx ${status}`,
          description: `Took ${durationMs}ms`,
          variant: 'destructive',
        });
      }
    });
  };

  const handleDelete = (id: string, url: string) => {
    startTransition(async () => {
      const result = await actionDeleteEmailWebhook(id);
      if (!result.ok) {
        zoruToast({ title: 'Delete failed', description: result.error, variant: 'destructive' });
        return;
      }
      zoruToast({ title: `Deleted ${url}` });
      onChanged();
    });
  };

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead>Endpoint</ZoruTableHead>
            <ZoruTableHead>Events</ZoruTableHead>
            <ZoruTableHead>Status</ZoruTableHead>
            <ZoruTableHead>Last delivery</ZoruTableHead>
            <ZoruTableHead className="w-[60px]" />
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {webhooks.map((w) => (
            <ZoruTableRow key={w._id}>
              <ZoruTableCell>
                <div className="font-medium text-zoru-ink">{w.name ?? '—'}</div>
                <code className="block max-w-[320px] truncate text-xs text-zoru-ink-muted">
                  {w.url}
                </code>
              </ZoruTableCell>
              <ZoruTableCell>
                <div className="flex flex-wrap gap-1">
                  {w.events.slice(0, 3).map((e) => (
                    <Badge key={e} variant="secondary">
                      {e}
                    </Badge>
                  ))}
                  {w.events.length > 3 ? (
                    <Badge variant="ghost">+{w.events.length - 3}</Badge>
                  ) : null}
                </div>
              </ZoruTableCell>
              <ZoruTableCell>
                {w.active ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="secondary">Paused</Badge>
                )}
                {w.failureCount && w.failureCount > 0 ? (
                  <Badge variant="destructive" className="ml-1">
                    {w.failureCount} fail
                  </Badge>
                ) : null}
              </ZoruTableCell>
              <ZoruTableCell className="text-sm text-zoru-ink-muted">
                {w.lastDeliveryAt ? (
                  <>
                    {formatDistanceToNow(new Date(w.lastDeliveryAt), { addSuffix: true })}
                    {w.lastDeliveryStatus ? (
                      <span className="ml-1 font-mono text-xs">
                        ({w.lastDeliveryStatus})
                      </span>
                    ) : null}
                  </>
                ) : (
                  'Never'
                )}
              </ZoruTableCell>
              <ZoruTableCell>
                <DropdownMenu>
                  <ZoruDropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={pending}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </ZoruDropdownMenuTrigger>
                  <ZoruDropdownMenuContent align="end">
                    <ZoruDropdownMenuItem onSelect={() => handleTest(w._id)}>
                      <Send className="h-4 w-4" /> Send test
                    </ZoruDropdownMenuItem>
                    <ZoruDropdownMenuItem onSelect={() => onEdit(w)}>
                      <Pencil className="h-4 w-4" /> Edit
                    </ZoruDropdownMenuItem>
                    <ZoruDropdownMenuSeparator />
                    <ZoruAlertDialog>
                      <ZoruAlertDialogTrigger asChild>
                        <ZoruDropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          className="text-zoru-ink"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </ZoruDropdownMenuItem>
                      </ZoruAlertDialogTrigger>
                      <ZoruAlertDialogContent>
                        <ZoruAlertDialogHeader>
                          <ZoruAlertDialogTitle>Delete webhook?</ZoruAlertDialogTitle>
                          <ZoruAlertDialogDescription>
                            <code>{w.url}</code> will stop receiving events. This cannot be undone.
                          </ZoruAlertDialogDescription>
                        </ZoruAlertDialogHeader>
                        <ZoruAlertDialogFooter>
                          <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                          <ZoruAlertDialogAction
                            onClick={() => handleDelete(w._id, w.url)}
                          >
                            Delete
                          </ZoruAlertDialogAction>
                        </ZoruAlertDialogFooter>
                      </ZoruAlertDialogContent>
                    </ZoruAlertDialog>
                  </ZoruDropdownMenuContent>
                </DropdownMenu>
              </ZoruTableCell>
            </ZoruTableRow>
          ))}
        </ZoruTableBody>
      </Table>
    </Card>
  );
}
