'use client';

import { useCallback, useEffect, useState } from 'react';
import { LuKey, LuPlus, LuLoader, LuExternalLink } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { CREDENTIAL_TYPE_LABEL, type CredentialType, type MaskedCredential } from '@/lib/sabflow/credentials/types';
import { selectClass } from './primitives';

// ── Types ────────────────────────────────────────────────────────────────────

type Props = {
  /** The credential type this block requires (used to filter the list). */
  credentialType: CredentialType;
  /** Currently selected credential id (from block.options.credentialId). */
  value?: string;
  /** Called with the selected credential id (or undefined to clear). */
  onChange: (credentialId: string | undefined) => void;
};

// ── Component ────────────────────────────────────────────────────────────────

export function CredentialSelect({ credentialType, value, onChange }: Props) {
  const [credentials, setCredentials] = useState<MaskedCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/sabflow/credentials?type=${encodeURIComponent(credentialType)}`)
      .then((r) => r.json())
      .then((j: { credentials?: MaskedCredential[]; error?: string }) => {
        if (j.error) throw new Error(j.error);
        setCredentials(j.credentials ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [credentialType]);

  useEffect(() => {
    load();
  }, [load]);

  const typeName = CREDENTIAL_TYPE_LABEL[credentialType] ?? credentialType;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[11.5px] text-[var(--gray-8)]">
        <LuLoader className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} />
        Loading credentials…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-[11.5px] text-zoru-ink rounded-lg border border-zoru-line bg-zoru-surface-2 px-3 py-2">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          {/* leading icon */}
          <LuKey
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--gray-7)]"
            strokeWidth={1.8}
          />
          <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={cn(selectClass, 'pl-8 pr-3')}
          >
            <option value="">— select {typeName} credential —</option>
            {credentials.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={load}
          title="Refresh credential list"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-8)] hover:text-[var(--gray-12)] hover:bg-[var(--gray-3)] transition-colors shrink-0"
        >
          <LuLoader className="h-3.5 w-3.5" strokeWidth={1.8} />
        </button>
      </div>

      {credentials.length === 0 ? (
        <a
          href="/dashboard/sabflow/connections"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11.5px] text-zoru-ink hover:text-zoru-ink transition-colors"
        >
          <LuPlus className="h-3.5 w-3.5" strokeWidth={2} />
          Add {typeName} credential
          <LuExternalLink className="h-3 w-3 opacity-70" strokeWidth={1.8} />
        </a>
      ) : (
        <a
          href="/dashboard/sabflow/connections"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] text-[var(--gray-8)] hover:text-[var(--gray-11)] transition-colors"
        >
          <LuPlus className="h-3 w-3" strokeWidth={2} />
          Manage credentials
          <LuExternalLink className="h-3 w-3 opacity-60" strokeWidth={1.8} />
        </a>
      )}
    </div>
  );
}
