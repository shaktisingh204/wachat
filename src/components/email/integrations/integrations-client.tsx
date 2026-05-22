'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Network, Plus } from 'lucide-react';
import {
  Button,
  ZoruPageActions,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  zoruToast,
} from '@/components/zoruui';
import { cn } from '@/components/zoruui/lib/cn';
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
      zoruToast({ title: 'Failed to load API keys', description: result.error, variant: 'destructive' });
      return;
    }
    setKeys(result.data);
  }, []);

  const fetchWebhooks = useCallback(async () => {
    const result = await actionListEmailWebhooks();
    if (!result.ok) {
      zoruToast({ title: 'Failed to load webhooks', description: result.error, variant: 'destructive' });
      return;
    }
    setWebhooks(result.data);
  }, []);

  useEffect(() => {
    void Promise.all([fetchKeys(), fetchWebhooks()]).then(() => setLoading(false));
  }, [fetchKeys, fetchWebhooks]);

  return (
    <div className="space-y-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-3">
              <Network className="h-6 w-6" /> Integrations
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            API keys and outbound webhooks that connect the email engine to your stack.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          {pane === 'keys' ? (
            <ZoruButton onClick={() => setKeyDialogOpen(true)}>
              <Plus className="h-4 w-4" /> New API key
            </ZoruButton>
          ) : (
            <ZoruButton
              onClick={() => {
                setEditingHook(null);
                setHookFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New webhook
            </ZoruButton>
          )}
        </ZoruPageActions>
      </ZoruPageHeader>

      {/* Segmented control — not tabs, per zoruui directive. */}
      <div
        role="tablist"
        aria-label="Integrations sections"
        className="inline-flex rounded-[var(--zoru-radius-md)] border border-zoru-line bg-zoru-surface p-1"
      >
        {([
          { key: 'keys', label: 'API keys', icon: KeyRound, count: keys.length },
          { key: 'webhooks', label: 'Webhooks', icon: Network, count: webhooks.length },
        ] as const).map((seg) => {
          const Icon = seg.icon;
          const isActive = pane === seg.key;
          return (
            <button
              key={seg.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setPane(seg.key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-[var(--zoru-radius-sm)] px-3 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-zoru-bg text-zoru-ink shadow-[var(--zoru-shadow-sm)]'
                  : 'text-zoru-ink-muted hover:text-zoru-ink',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {seg.label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-xs',
                  isActive ? 'bg-zoru-surface-2 text-zoru-ink' : 'bg-zoru-surface text-zoru-ink-muted',
                )}
              >
                {seg.count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2">
          <ZoruSkeleton className="h-12 w-full" />
          <ZoruSkeleton className="h-12 w-full" />
          <ZoruSkeleton className="h-12 w-full" />
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
