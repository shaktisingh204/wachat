'use client';

import { useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { KeyRound, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, Badge, Button, Card, EmptyState, Table, TBody, Td, Th, THead, Tr, toast } from '@/components/sabcrm/20ui/compat';
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
      <EmptyState
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
        toast({ title: 'Revoke failed', description: result.error, variant: 'destructive' });
        return;
      }
      toast({ title: `Revoked "${name}"` });
      onChanged();
    });
  };

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <THead>
          <Tr>
            <Th>Name</Th>
            <Th>Key prefix</Th>
            <Th>Scopes</Th>
            <Th>Last used</Th>
            <Th className="w-[80px] text-right">Actions</Th>
          </Tr>
        </THead>
        <TBody>
          {keys.map((k) => (
            <Tr key={k._id}>
              <Td className="font-medium text-[var(--st-text)]">
                {k.name}
                {k.revokedAt ? (
                  <Badge variant="destructive" className="ml-2">Revoked</Badge>
                ) : null}
              </Td>
              <Td>
                <code className="rounded bg-[var(--st-bg-muted)] px-1.5 py-0.5 text-xs text-[var(--st-text)]">
                  {k.prefix}…
                </code>
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {k.scopes.map((s) => (
                    <Badge key={s} variant="secondary">{s}</Badge>
                  ))}
                </div>
              </Td>
              <Td className="text-sm text-[var(--st-text-secondary)]">
                {k.lastUsedAt
                  ? formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true })
                  : 'Never'}
              </Td>
              <Td className="text-right">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending || !!k.revokedAt}
                      aria-label="Revoke API key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Revoke this API key?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Any client using <code>{k.prefix}…</code> will immediately
                        stop working. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleRevoke(k._id, k.name)}
                      >
                        Revoke
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
