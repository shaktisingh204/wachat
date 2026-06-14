'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ArrowRight, Check, Plug } from 'lucide-react';

import { seedConnectorAction } from '@/app/actions/sabbi-connectors.actions';
import { Button } from '@/components/sabcrm/20ui';

export function ConnectButton({
  connectorKey,
  connectedModelId,
}: {
  connectorKey: string;
  connectedModelId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (connectedModelId) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-sm text-[var(--st-success)]">
          <Check size={14} aria-hidden="true" /> Connected
        </span>
        <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/sabbi/models/${connectedModelId}`)}>
          Open model
          <ArrowRight size={14} aria-hidden="true" />
        </Button>
      </div>
    );
  }

  function connect() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await seedConnectorAction(connectorKey);
        router.push(`/dashboard/sabbi/models/${res.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to connect');
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={connect} disabled={pending}>
        <Plug size={14} aria-hidden="true" />
        {pending ? 'Connecting…' : 'Connect'}
      </Button>
      {error && <span className="text-xs text-[var(--st-danger)]">{error}</span>}
    </div>
  );
}
