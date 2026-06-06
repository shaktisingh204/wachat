'use client';

import { useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, Network, Pencil, Send, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, Badge, Button, Card, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, EmptyState, Table, TBody, Td, Th, THead, Tr, toast } from '@/components/sabcrm/20ui/compat';
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
        toast({ title: 'Test failed', description: result.error, variant: 'destructive' });
        return;
      }
      const { status, durationMs, error } = result.data;
      if (error) {
        toast({ title: `Test errored (${status})`, description: error, variant: 'destructive' });
      } else if (status >= 200 && status < 300) {
        toast({ title: `OK ${status} · ${durationMs}ms` });
      } else {
        toast({
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
        toast({ title: 'Delete failed', description: result.error, variant: 'destructive' });
        return;
      }
      toast({ title: `Deleted ${url}` });
      onChanged();
    });
  };

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <THead>
          <Tr>
            <Th>Endpoint</Th>
            <Th>Events</Th>
            <Th>Status</Th>
            <Th>Last delivery</Th>
            <Th className="w-[60px]" />
          </Tr>
        </THead>
        <TBody>
          {webhooks.map((w) => (
            <Tr key={w._id}>
              <Td>
                <div className="font-medium text-[var(--st-text)]">{w.name ?? '—'}</div>
                <code className="block max-w-[320px] truncate text-xs text-[var(--st-text-secondary)]">
                  {w.url}
                </code>
              </Td>
              <Td>
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
              </Td>
              <Td>
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
              </Td>
              <Td className="text-sm text-[var(--st-text-secondary)]">
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
              </Td>
              <Td>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={pending}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => handleTest(w._id)}>
                      <Send className="h-4 w-4" /> Send test
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onEdit(w)}>
                      <Pencil className="h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          className="text-[var(--st-text)]"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete webhook?</AlertDialogTitle>
                          <AlertDialogDescription>
                            <code>{w.url}</code> will stop receiving events. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(w._id, w.url)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
