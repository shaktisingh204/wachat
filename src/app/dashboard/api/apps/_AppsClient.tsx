'use client';

import { useState, useTransition } from 'react';
import {
  registerOAuthApp,
  deleteOAuthApp,
  type OAuthAppRow,
} from '@/app/actions/developer-platform.actions';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Button,
  IconButton,
  Input,
  Textarea,
  Field,
  Alert,
  EmptyState,
  Separator,
  Progress,
  Badge,
  useToast,
} from '@/components/sabcrm/20ui';
import { TriangleAlert, Copy, Boxes, Trash2, BarChart2 } from 'lucide-react';

interface UsageRow {
  keyId: string;
  count?: number;
  errorCount?: number;
  lastUsedAt?: string;
}

interface Props {
  initialApps: OAuthAppRow[];
  usageData?: UsageRow[];
}

const REQUEST_LIMIT = 10000;

export function AppsClient({ initialApps, usageData = [] }: Props): JSX.Element {
  const { toast } = useToast();
  const [apps, setApps] = useState<OAuthAppRow[]>(initialApps);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [redirects, setRedirects] = useState('');
  const [scopes, setScopes] = useState('me:read');
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const handleCreate = (): void => {
    const redirectUris = redirects
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!name.trim() || redirectUris.length === 0) {
      toast.error('Name and at least one redirect URI are required.');
      return;
    }
    startBusy(async () => {
      const res = await registerOAuthApp({
        name: name.trim(),
        description: description.trim() || undefined,
        redirectUris,
        scopes: scopes.split(/[\s,]+/).filter(Boolean),
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setApps((prev) => [res.app, ...prev]);
      setSecret(res.clientSecret);
      setName('');
      setDescription('');
      setRedirects('');
      toast.success('OAuth app registered.');
    });
  };

  const handleDelete = (id: string): void => {
    if (!confirm('Delete this app? All issued tokens will be revoked.')) return;
    startBusy(async () => {
      const res = await deleteOAuthApp(id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setApps((prev) => prev.filter((a) => a._id !== id));
      toast.success('App deleted.');
    });
  };

  const copySecret = (value: string): void => {
    navigator.clipboard.writeText(value);
    toast.success('Client secret copied.');
  };

  return (
    <div className="space-y-4">
      {secret ? (
        <Alert
          tone="warning"
          icon={TriangleAlert}
          title="Save this client secret. It is shown once."
          onClose={() => setSecret(null)}
        >
          <div className="space-y-2">
            <p className="text-xs">Configure it alongside the client_id in your OAuth client.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 font-mono text-xs text-[var(--st-text)]">
                {secret}
              </code>
              <Button
                size="sm"
                variant="outline"
                iconLeft={Copy}
                onClick={() => copySecret(secret)}
              >
                Copy
              </Button>
            </div>
          </div>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Register OAuth app</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
            </Field>
            <Field label="Description">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={busy}
              />
            </Field>
            <Field label="Redirect URIs (one per line)" className="sm:col-span-2">
              <Textarea
                value={redirects}
                onChange={(e) => setRedirects(e.target.value)}
                rows={2}
                placeholder="https://yourapp.com/oauth/callback"
                className="font-mono"
                disabled={busy}
              />
            </Field>
            <Field label="Requested scopes (space-separated)" className="sm:col-span-2">
              <Input
                value={scopes}
                onChange={(e) => setScopes(e.target.value)}
                className="font-mono"
                disabled={busy}
              />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={handleCreate}
              loading={busy}
              disabled={busy || !name.trim()}
            >
              Register
            </Button>
          </div>
        </CardBody>
      </Card>

      {apps.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No OAuth apps yet"
          description="Register an app above to get started."
        />
      ) : (
        <div className="space-y-3">
          {apps.map((a) => {
            const usage = usageData.find((u) => u.keyId === a.clientId);
            const requestCount = usage?.count ?? 0;
            const errorCount = usage?.errorCount ?? 0;
            const rateLimited = requestCount >= REQUEST_LIMIT;
            const usagePct = Math.min(100, (requestCount / REQUEST_LIMIT) * 100);
            return (
              <Card key={a._id}>
                <CardBody className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--st-text)]">{a.name}</p>
                      {a.description ? (
                        <p className="mt-0.5 text-xs text-[var(--st-text-secondary)]">
                          {a.description}
                        </p>
                      ) : null}
                    </div>
                    <IconButton
                      label="Delete app"
                      icon={Trash2}
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(a._id)}
                      disabled={busy}
                    />
                  </div>

                  <Separator className="my-3" />

                  <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <p className="mb-0.5 text-[var(--st-text-tertiary)]">Client ID</p>
                      <code className="font-mono text-[var(--st-text)]">{a.clientId}</code>
                    </div>
                    <div>
                      <p className="mb-0.5 text-[var(--st-text-tertiary)]">Created</p>
                      <p className="text-[var(--st-text)]">
                        {new Date(a.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="mb-0.5 text-[var(--st-text-tertiary)]">Redirect URIs</p>
                      <ul className="space-y-0.5 font-mono text-[var(--st-text)]">
                        {a.redirectUris.map((u) => (
                          <li key={u}>{u}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="mb-0.5 text-[var(--st-text-tertiary)]">Allowed scopes</p>
                      <code className="font-mono text-[var(--st-text)]">{a.scopes.join(' ')}</code>
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] p-3">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
                      <BarChart2 className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
                      Usage and rate limit
                    </div>

                    <div className="space-y-4 text-xs">
                      <div>
                        <div className="mb-1 flex items-end justify-between">
                          <p className="text-[var(--st-text-tertiary)]">API requests (30d)</p>
                          <p className="font-medium text-[var(--st-text)]">
                            {requestCount.toLocaleString()} / {REQUEST_LIMIT.toLocaleString()}
                          </p>
                        </div>
                        <Progress
                          value={usagePct}
                          tone={rateLimited ? 'danger' : 'accent'}
                          size="sm"
                          aria-label="API request usage"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="mb-1 text-[var(--st-text-tertiary)]">Status</p>
                          <Badge tone={rateLimited ? 'danger' : 'success'}>
                            {rateLimited ? 'Rate Limited' : 'Active'}
                          </Badge>
                        </div>
                        <div>
                          <p className="mb-1 text-[var(--st-text-tertiary)]">Errors (30d)</p>
                          <p className="font-medium text-[var(--st-text)]">{errorCount}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="mb-1 text-[var(--st-text-tertiary)]">Last used</p>
                          <p className="font-medium text-[var(--st-text)]">
                            {usage?.lastUsedAt
                              ? new Date(usage.lastUsedAt).toLocaleString()
                              : 'Never'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
