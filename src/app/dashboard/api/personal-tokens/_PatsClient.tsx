'use client';

import { useState, useTransition } from 'react';
import {
  createPersonalToken,
  revokePersonalToken,
} from '@/app/actions/developer-platform.actions';

interface PatRow {
  _id: string;
  name: string;
  userId: string;
  scopes: string[];
  tier: string;
  revoked: boolean;
  requestCount: number;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

interface Props {
  initialTokens: PatRow[];
}

export function PatsClient({ initialTokens }: Props): JSX.Element {
  const [tokens, setTokens] = useState<PatRow[]>(initialTokens);
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const handleCreate = (): void => {
    if (!name.trim()) return;
    setError(null);
    startBusy(async () => {
      const res = await createPersonalToken(name.trim(), undefined, expiresAt || undefined);
      if (!res.success) {
        setError(res.error);
        return;
      }
      if (res.token && res.tokenId) {
        setRevealed(res.token);
        setTokens((prev) => [
          {
            _id: res.tokenId!,
            name: name.trim(),
            userId: '',
            scopes: ['*'],
            tier: 'FREE',
            revoked: false,
            requestCount: 0,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt || undefined,
          },
          ...prev,
        ]);
      }
      setName('');
      setExpiresAt('');
    });
  };

  const handleRevoke = (id: string): void => {
    if (!confirm('Revoke this token? Any script using it will fail.')) return;
    startBusy(async () => {
      const res = await revokePersonalToken(id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setTokens((prev) => prev.map((t) => (t._id === id ? { ...t, revoked: true } : t)));
    });
  };

  return (
    <div className="space-y-6">
      {revealed ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="text-sm font-semibold text-amber-300 mb-1">Save this token now</div>
          <div className="text-xs text-amber-200 mb-2">
            Shown once. Treat it as a password — anyone with this token can act as you.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 overflow-x-auto">
              {revealed}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(revealed)}
              className="px-3 py-2 text-xs border border-amber-500/40 rounded hover:bg-amber-500/20"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => setRevealed(null)}
              className="px-3 py-2 text-xs border border-zinc-700 rounded hover:bg-zinc-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-md border border-zinc-800 bg-zinc-900/30 p-4">
        <div className="text-sm font-semibold mb-2">Generate Personal Access Token</div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-center">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. local-dev"
            className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
            disabled={busy}
          />
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
            className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300"
            disabled={busy}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy || !name.trim()}
            className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold rounded disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Generate'}
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          PATs inherit your RBAC, so they can only do what your user account is allowed to do.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="rounded-md border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/50 text-zinc-400 text-xs">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Scopes</th>
              <th className="text-left px-3 py-2">Created</th>
              <th className="text-left px-3 py-2">Expires</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tokens.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                  No tokens yet.
                </td>
              </tr>
            ) : null}
            {tokens.map((t) => (
              <tr key={t._id} className="border-t border-zinc-800">
                <td className="px-3 py-2">{t.name}</td>
                <td className="px-3 py-2 text-zinc-400 text-xs font-mono">
                  {t.scopes.join(' ') || '*'}
                </td>
                <td className="px-3 py-2 text-zinc-400 text-xs">{fmt(t.createdAt)}</td>
                <td className="px-3 py-2 text-zinc-400 text-xs">
                  {t.expiresAt ? fmt(t.expiresAt) : '—'}
                </td>
                <td className="px-3 py-2 text-xs">
                  {t.revoked ? <span className="text-red-400">Revoked</span> : <span className="text-green-400">Active</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  {!t.revoked ? (
                    <button
                      type="button"
                      onClick={() => handleRevoke(t._id)}
                      disabled={busy}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Revoke
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
