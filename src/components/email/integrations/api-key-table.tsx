'use client';

import { useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { KeyRound, Trash2 } from 'lucide-react';
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
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  zoruToast,
} from '@/components/zoruui';
import {
  actionRevokeEmailApiKey,
  type EmailApiKeyDoc,
} from '@/app/actions/email/integrations.actions';

interface ApiKeyTableProps {
  keys: EmailApiKeyDoc[];
  onChanged: () => void;
}

export function ApiKeyTable({ keys, onChanged }: ApiKeyTableProps) {
  const [pending, startTransition] = useTransition();

  if (keys.length === 0) {
    return (
      <ZoruEmptyState
        icon={<KeyRound />}
        title="No API keys yet"
        description="Create an API key to send transactional mail and access reports programmatically."
      />
    );
  }

  const handleRevoke = (id: string, name: string) => {
    startTransition(async () => {
      const result = await actionRevokeEmailApiKey(id);
      if (!result.ok) {
        zoruToast({ title: 'Revoke failed', description: result.error, variant: 'destructive' });
        return;
      }
      zoruToast({ title: `Revoked "${name}"` });
      onChanged();
    });
  };

  return (
    <ZoruCard className="overflow-hidden p-0">
      <ZoruTable>
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead>Name</ZoruTableHead>
            <ZoruTableHead>Key prefix</ZoruTableHead>
            <ZoruTableHead>Scopes</ZoruTableHead>
            <ZoruTableHead>Last used</ZoruTableHead>
            <ZoruTableHead className="w-[80px] text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {keys.map((k) => (
            <ZoruTableRow key={k._id}>
              <ZoruTableCell className="font-medium text-zoru-ink">
                {k.name}
                {k.revokedAt ? (
                  <ZoruBadge variant="destructive" className="ml-2">Revoked</ZoruBadge>
                ) : null}
              </ZoruTableCell>
              <ZoruTableCell>
                <code className="rounded bg-zoru-surface-2 px-1.5 py-0.5 text-xs text-zoru-ink">
                  {k.prefix}…
                </code>
              </ZoruTableCell>
              <ZoruTableCell>
                <div className="flex flex-wrap gap-1">
                  {k.scopes.map((s) => (
                    <ZoruBadge key={s} variant="secondary">{s}</ZoruBadge>
                  ))}
                </div>
              </ZoruTableCell>
              <ZoruTableCell className="text-sm text-zoru-ink-muted">
                {k.lastUsedAt
                  ? formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true })
                  : 'Never'}
              </ZoruTableCell>
              <ZoruTableCell className="text-right">
                <ZoruAlertDialog>
                  <ZoruAlertDialogTrigger asChild>
                    <ZoruButton
                      variant="ghost"
                      size="icon"
                      disabled={pending || !!k.revokedAt}
                      aria-label="Revoke API key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </ZoruButton>
                  </ZoruAlertDialogTrigger>
                  <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                      <ZoruAlertDialogTitle>Revoke this API key?</ZoruAlertDialogTitle>
                      <ZoruAlertDialogDescription>
                        Any client using <code>{k.prefix}…</code> will immediately
                        stop working. This cannot be undone.
                      </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                      <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                      <ZoruAlertDialogAction
                        onClick={() => handleRevoke(k._id, k.name)}
                      >
                        Revoke
                      </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                  </ZoruAlertDialogContent>
                </ZoruAlertDialog>
              </ZoruTableCell>
            </ZoruTableRow>
          ))}
        </ZoruTableBody>
      </ZoruTable>
    </ZoruCard>
  );
}
