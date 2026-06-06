'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Button,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useState,
  useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plug,
  PlugZap,
  Trash2 } from 'lucide-react';

/**
 * Client islands for the integration detail page action group:
 *   - <IntegrationConnectButton /> flips `isActive` and remaps `status`
 *     between `'connected'` / `'disconnected'`.
 *   - <IntegrationDeleteButton /> hard-deletes the integration after a
 *     confirm dialog.
 *
 * Credentials are NEVER passed through these islands — the server-side
 * actions read existing secrets from Mongo and only the public sentinel
 * `'***hidden***'` ever crosses the boundary.
 */

import {
  deleteIntegration,
  setIntegrationActive,
} from '@/app/actions/crm-integrations.actions';

export function IntegrationConnectButton({
  integrationId,
  isActive,
}: {
  integrationId: string;
  isActive: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useZoruToast();

  return (
    <Button
      variant={isActive ? 'outline' : 'default'}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setIntegrationActive(integrationId, !isActive);
          if (res.success) {
            toast({
              title: isActive ? 'Disconnected' : 'Connected',
            });
            router.refresh();
          } else {
            toast({
              title: 'Error',
              description: res.error ?? 'Could not change status.',
              variant: 'destructive',
            });
          }
        })
      }
    >
      {isActive ? (
        <Plug className="mr-2 h-4 w-4" />
      ) : (
        <PlugZap className="mr-2 h-4 w-4" />
      )}
      {isActive ? 'Disconnect' : 'Connect'}
    </Button>
  );
}

export function IntegrationDeleteButton({
  integrationId,
  name,
}: {
  integrationId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useZoruToast();

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Trash2 className="mr-2 h-4 w-4 text-zoru-danger-ink" />
        Delete
      </Button>
      <ZoruAlertDialog open={open} onOpenChange={setOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete integration?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Deleting &ldquo;{name}&rdquo; will permanently remove its
              configuration and encrypted credentials. This cannot be
              undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={pending}>
              Cancel
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteIntegration(integrationId);
                  if (res.success) {
                    toast({ title: 'Integration deleted' });
                    router.push('/dashboard/crm/integrations');
                  } else {
                    toast({
                      title: 'Error',
                      description: res.error ?? 'Could not delete.',
                      variant: 'destructive',
                    });
                  }
                })
              }
            >
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </>
  );
}

import { RefreshCw } from 'lucide-react';
import { triggerManualSync } from '@/app/actions/crm-integrations.actions';

export function IntegrationSyncButton({
  integrationId,
}: {
  integrationId: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useZoruToast();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await triggerManualSync(integrationId);
          if (res.success) {
            toast({
              title: 'Sync triggered',
              description: 'The integration is now syncing.',
            });
            router.refresh();
          } else {
            toast({
              title: 'Sync Failed',
              description: res.error ?? 'Could not start sync.',
              variant: 'destructive',
            });
          }
        })
      }
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
      Manual Sync
    </Button>
  );
}

