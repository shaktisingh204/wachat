'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Network, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  SegmentedControl,
  Skeleton,
  toast,
} from '@/components/sabcrm/20ui';
import {
  actionListEmailApiKeys,
  actionListEmailWebhooks,
  type EmailApiKeyDoc,
  type EmailWebhookDoc,
} from '@/app/actions/email/integrations.actions';
import { ApiKeyTable } from './api-key-table';
import { ApiKeyCreateDialog } from './api-key-create-dialog';
import { WebhookTable } from './webhook-table';
import { WebhookForm } from './webhook-form';

type Pane = 'keys' | 'webhooks';

export function IntegrationsClient() {
  const [pane, setPane] = useState<Pane>('keys');
  const [keys, setKeys] = useState<EmailApiKeyDoc[]>([]);
  const [webhooks, setWebhooks] = useState<EmailWebhookDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [hookFormOpen, setHookFormOpen] = useState(false);
  const [editingHook, setEditingHook] = useState<EmailWebhookDoc | null>(null);

  const fetchKeys = useCallback(async () => {
    const result = await actionListEmailApiKeys();
    if (!result.ok) {
      toast({ title: 'Failed to load API keys', description: result.error, tone: 'danger' });
      return;
    }
    setKeys(result.data);
  }, []);

  const fetchWebhooks = useCallback(async () => {
    const result = await actionListEmailWebhooks();
    if (!result.ok) {
      toast({ title: 'Failed to load webhooks', description: result.error, tone: 'danger' });
      return;
    }
    setWebhooks(result.data);
  }, []);

  useEffect(() => {
    void Promise.all([fetchKeys(), fetchWebhooks()]).then(() => setLoading(false));
  }, [fetchKeys, fetchWebhooks]);

  return (
    <div className="space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>
            <span className="inline-flex items-center gap-3">
              <Network className="h-6 w-6" aria-hidden="true" /> Integrations
            </span>
          </PageTitle>
          <PageDescription>
            API keys and outbound webhooks that connect the email engine to your stack.
          </PageDescription>
        </PageHeading>
        <PageActions>
          {pane === 'keys' ? (
            <Button onClick={() => setKeyDialogOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" /> New API key
            </Button>
          ) : (
            <Button
              onClick={() => {
                setEditingHook(null);
                setHookFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> New webhook
            </Button>
          )}
        </PageActions>
      </PageHeader>

      <SegmentedControl<Pane>
        aria-label="Integrations sections"
        value={pane}
        onChange={setPane}
        items={[
          {
            value: 'keys',
            icon: KeyRound,
            label: (
              <span className="inline-flex items-center gap-2">
                API keys
                <Badge tone="neutral">{keys.length}</Badge>
              </span>
            ),
          },
          {
            value: 'webhooks',
            icon: Network,
            label: (
              <span className="inline-flex items-center gap-2">
                Webhooks
                <Badge tone="neutral">{webhooks.length}</Badge>
              </span>
            ),
          },
        ]}
      />

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : pane === 'keys' ? (
        <ApiKeyTable keys={keys} onChanged={fetchKeys} />
      ) : (
        <WebhookTable
          webhooks={webhooks}
          onEdit={(w) => {
            setEditingHook(w);
            setHookFormOpen(true);
          }}
          onChanged={fetchWebhooks}
        />
      )}

      <ApiKeyCreateDialog
        open={keyDialogOpen}
        onOpenChange={setKeyDialogOpen}
        onCreated={fetchKeys}
      />
      <WebhookForm
        open={hookFormOpen}
        onOpenChange={setHookFormOpen}
        webhook={editingHook}
        onSaved={fetchWebhooks}
      />
    </div>
  );
}
