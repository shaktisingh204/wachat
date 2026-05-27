'use client';

import { Button, Card, Badge, useZoruToast } from '@/components/zoruui';
import * as React from 'react';
import { Bell, CheckCheck, Check } from 'lucide-react';

import {
  markNotificationRead,
  markAllNotificationsRead,
  getMyNotifications,
} from '@/app/actions/worksuite/chat.actions';
import type { WsNotification } from '@/lib/worksuite/chat-types';

type Row = WsNotification & { _id: string };

export interface NotificationsInboxProps {
  initialNotifications: Row[];
}

function formatStamp(value?: string | Date | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationsInbox({ initialNotifications }: NotificationsInboxProps) {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<Row[]>(initialNotifications);
  const [busyAll, setBusyAll] = React.useState(false);

  const unread = rows.filter((r) => !r.read_at).length;

  const refresh = async () => {
    const latest = (await getMyNotifications()) as Row[];
    setRows(latest);
  };

  const markAll = async () => {
    if (unread === 0) return;
    setBusyAll(true);
    const res = await markAllNotificationsRead();
    setBusyAll(false);
    if (res.success) {
      toast({ title: 'All notifications marked read' });
      await refresh();
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  const markOne = async (id: string) => {
    const res = await markNotificationRead(id);
    if (res.success) {
      setRows((prev) =>
        prev.map((r) => (r._id === id ? { ...r, read_at: new Date().toISOString() } : r)),
      );
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={unread > 0 ? 'danger' : 'ghost'}>
            {unread} unread
          </Badge>
          <Badge variant="ghost">{rows.length} total</Badge>
        </div>
        <Button
          variant="pill"
          size="sm"
          onClick={markAll}
          disabled={busyAll || unread === 0}
          leading={<CheckCheck className="h-3.5 w-3.5" />}
        >
          Mark all read
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card className="flex items-center justify-center py-12">
          <p className="text-[13px] text-zoru-ink-muted">Your inbox is empty.</p>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-zoru-line">
            {rows.map((n) => {
              const read = Boolean(n.read_at);
              return (
                <li
                  key={n._id}
                  className={
                    'flex items-start gap-3 px-4 py-3 ' +
                    (read ? '' : 'bg-zoru-surface-2/40')
                  }
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zoru-surface-2">
                    <Bell className="h-4 w-4 text-zoru-ink-muted" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium text-zoru-ink">
                        {n.title}
                      </span>
                      <Badge variant="ghost">{n.type}</Badge>
                      {!read ? <Badge variant="danger">New</Badge> : null}
                      <span className="ml-auto text-[11.5px] text-zoru-ink-muted">
                        {formatStamp(n.createdAt)}
                      </span>
                    </div>
                    {n.body ? (
                      <p className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">
                        {n.body}
                      </p>
                    ) : null}
                  </div>
                  {!read ? (
                    <Button
                      size="sm"
                      variant="pill"
                      onClick={() => markOne(n._id)}
                      leading={<Check className="h-3.5 w-3.5" />}
                    >
                      Mark read
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
