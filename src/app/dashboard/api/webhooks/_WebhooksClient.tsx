'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import {
  createWebhookSubscription,
  deleteWebhookSubscription,
  testWebhookSubscription,
  listWebhookDeliveries,
  retryWebhookDelivery,
  type WebhookSubscription,
  type WebhookDelivery,
} from '@/app/actions/developer-platform.actions';

interface Props {
  initialSubs: WebhookSubscription[];
  initialDeliveries: WebhookDelivery[];
}

export function WebhooksClient({ initialSubs, initialDeliveries }: Props): JSX.Element {
  const [subs, setSubs] = useState<WebhookSubscription[]>(initialSubs);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>(initialDeliveries);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState('contact.created\nwachat.message.sent');
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  const reloadDeliveries = useCallback((): void => {
    startBusy(async () => {
      const res = await listWebhookDeliveries(selectedSubId ?? undefined, 50);
      if (res.success) setDeliveries(res.deliveries);
    });
  }, [selectedSubId]);

  useEffect(() => {
    reloadDeliveries();
  }, [reloadDeliveries]);

  const handleCreate = (): void => {
    if (!url.trim()) return;
    setError(null);
    const eventList = events.split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean);
    startBusy(async () => {
      const res = await createWebhookSubscription({ url: url.trim(), events: eventList });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setSubs((prev) => [res.sub, ...prev]);
      setSecret(res.secret);
      setUrl('');
    });
  };

  const handleDelete = (id: string): void => {
    if (!confirm('Delete this subscription? Pending deliveries will be cancelled.')) return;
    startBusy(async () => {
      const res = await deleteWebhookSubscription(id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setSubs((prev) => prev.filter((s) => s._id !== id));
    });
  };

  const handleTest = (id: string): void => {
    startBusy(async () => {
      const res = await testWebhookSubscription(id);
      if (!res.success) setError(res.error);
      else reloadDeliveries();
    });
  };

  const handleRetry = (id: string): void => {
    startBusy(async () => {
      const res = await retryWebhookDelivery(id);
      if (!res.success) setError(res.error);
      else reloadDeliveries();
    });
  };

  return (
    <div className="space-y-8">
      {secret ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="text-sm font-semibold text-amber-300 mb-1">Save this signing secret</div>
          <div className="text-xs text-amber-200 mb-2">
            Use it to verify the <code>X-SabNode-Signature</code> header on every delivery.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 overflow-x-auto">
              {secret}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(secret)}
              className="px-3 py-2 text-xs border border-amber-500/40 rounded hover:bg-amber-500/20"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => setSecret(null)}
              className="px-3 py-2 text-xs border border-zinc-700 rounded hover:bg-zinc-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold mb-3">Subscriptions</h2>

        <div className="rounded-md border border-zinc-800 bg-zinc-900/30 p-4 mb-4">
          <div className="text-sm font-semibold mb-2">Create subscription</div>
          <div className="space-y-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourapp.com/webhooks/sabnode"
              className="block w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
              disabled={busy}
            />
            <textarea
              value={events}
              onChange={(e) => setEvents(e.target.value)}
              rows={3}
              placeholder="event.name (one per line, * to subscribe to everything)"
              className="block w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm font-mono text-xs"
              disabled={busy}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCreate}
                disabled={busy || !url.trim()}
                className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold rounded disabled:opacity-50"
              >
                {busy ? 'Working…' : 'Create'}
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="space-y-2">
          {subs.length === 0 ? (
            <div className="rounded-md border border-zinc-800 p-6 text-center text-sm text-zinc-500">
              No subscriptions yet.
            </div>
          ) : null}
          {subs.map((s) => (
            <div
              key={s._id}
              className={
                'rounded-md border p-3 bg-zinc-900/30 ' +
                (selectedSubId === s._id ? 'border-amber-500/40' : 'border-zinc-800')
              }
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-mono text-zinc-100 truncate">{s.url}</div>
                  <div className="text-xs text-zinc-500 mt-0.5 truncate">
                    Events: <span className="font-mono">{s.events.join(' ') || '(none)'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span
                    className={
                      s.status === 'active'
                        ? 'text-green-400'
                        : s.status === 'paused'
                          ? 'text-yellow-400'
                          : 'text-red-400'
                    }
                  >
                    {s.status}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedSubId((prev) => (prev === s._id ? null : s._id))
                    }
                    className="text-zinc-400 hover:text-zinc-100"
                  >
                    {selectedSubId === s._id ? 'Hide deliveries' : 'Filter'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTest(s._id)}
                    disabled={busy}
                    className="text-amber-300 hover:text-amber-200"
                  >
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s._id)}
                    disabled={busy}
                    className="text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent deliveries</h2>
          <button
            type="button"
            onClick={reloadDeliveries}
            disabled={busy}
            className="text-xs text-amber-300 hover:text-amber-200"
          >
            Refresh
          </button>
        </div>
        <div className="rounded-md border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-900/50 text-zinc-400">
              <tr>
                <th className="text-left px-3 py-2">Event</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Attempts</th>
                <th className="text-left px-3 py-2">HTTP</th>
                <th className="text-left px-3 py-2">When</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                    No deliveries yet. Click <em>Test</em> on a subscription to fire a synthetic event.
                  </td>
                </tr>
              ) : null}
              {deliveries.map((d) => (
                <tr key={d._id} className="border-t border-zinc-800">
                  <td className="px-3 py-2 font-mono text-zinc-100">{d.event}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        d.status === 'success'
                          ? 'text-green-400'
                          : d.status === 'failed'
                            ? 'text-red-400'
                            : 'text-zinc-400'
                      }
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{d.attempts}</td>
                  <td className="px-3 py-2 text-zinc-400">{d.responseStatus ?? '—'}</td>
                  <td className="px-3 py-2 text-zinc-400">{new Date(d.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    {d.status === 'failed' ? (
                      <button
                        type="button"
                        onClick={() => handleRetry(d._id)}
                        disabled={busy}
                        className="text-amber-300 hover:text-amber-200"
                      >
                        Retry
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
