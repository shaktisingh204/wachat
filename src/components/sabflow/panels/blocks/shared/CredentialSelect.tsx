'use client';

import { useCallback, useEffect, useState } from 'react';
import { Key, Plus, RefreshCw, ExternalLink } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  IconButton,
  Button,
  Spinner,
  Alert,
} from '@/components/sabcrm/20ui';
import { CREDENTIAL_TYPE_LABEL, type CredentialType, type MaskedCredential } from '@/lib/sabflow/credentials/types';

// Sentinel value for the "no credential selected" row. Radix Select forbids an
// empty-string item value, so we map it to/from `undefined` at the boundary.
const NONE_VALUE = '__none__';

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

  const openConnections = useCallback(() => {
    window.open('/dashboard/sabflow/connections', '_blank', 'noopener,noreferrer');
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[11.5px] text-[var(--st-text-secondary)]">
        <Spinner size="sm" label="Loading credentials" />
        Loading credentials...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <Alert tone="danger" title="Could not load credentials">
          {error}
        </Alert>
        <Button
          variant="outline"
          size="sm"
          iconLeft={RefreshCw}
          onClick={load}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          {/* leading icon */}
          <Key
            className="pointer-events-none absolute left-2.5 top-1/2 z-[1] -translate-y-1/2 h-3.5 w-3.5 text-[var(--st-text-tertiary)]"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <Select
            value={value ?? NONE_VALUE}
            onValueChange={(v) => onChange(v === NONE_VALUE ? undefined : v)}
          >
            <SelectTrigger className="pl-8" aria-label={`Select ${typeName} credential`}>
              <SelectValue placeholder={`Select ${typeName} credential`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>No {typeName} credential</SelectItem>
              {credentials.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Refresh button */}
        <IconButton
          label="Refresh credential list"
          icon={RefreshCw}
          variant="outline"
          size="md"
          onClick={load}
          className="shrink-0"
        />
      </div>

      {credentials.length === 0 ? (
        <Button
          variant="ghost"
          size="sm"
          iconLeft={Plus}
          iconRight={ExternalLink}
          onClick={openConnections}
        >
          Add {typeName} credential
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          iconLeft={Plus}
          iconRight={ExternalLink}
          onClick={openConnections}
        >
          Manage credentials
        </Button>
      )}
    </div>
  );
}
