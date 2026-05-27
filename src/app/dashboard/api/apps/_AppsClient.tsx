'use client';

import { useState, useTransition } from 'react';
import {
  registerOAuthApp,
  deleteOAuthApp,
  type OAuthAppRow,
} from '@/app/actions/developer-platform.actions';
import {
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardContent,
  Button,
  Input,
  Textarea,
  Label,
  Alert,
  ZoruAlertDescription,
  EmptyState,
  Separator,
  Progress,
  Badge,
} from '@/components/zoruui';
import { AlertCircle, TriangleAlert, Copy, Boxes, Trash2, Activity, BarChart2 } from 'lucide-react';

interface Props {
  initialApps: OAuthAppRow[];
  usageData?: any[];
}

export function AppsClient({ initialApps, usageData = [] }: Props): JSX.Element {
  const [apps, setApps] = useState<OAuthAppRow[]>(initialApps);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [redirects, setRedirects] = useState('');
  const [scopes, setScopes] = useState('me:read');
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const handleCreate = (): void => {
    const redirectUris = redirects
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!name.trim() || redirectUris.length === 0) {
      setError('name and at least one redirect URI are required.');
      return;
    }
    setError(null);
    startBusy(async () => {
      const res = await registerOAuthApp({
        name: name.trim(),
        description: description.trim() || undefined,
        redirectUris,
        scopes: scopes.split(/[\s,]+/).filter(Boolean),
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setApps((prev) => [res.app, ...prev]);
      setSecret(res.clientSecret);
      setName('');
      setDescription('');
      setRedirects('');
    });
  };

  const handleDelete = (id: string): void => {
    if (!confirm('Delete this app? All issued tokens will be revoked.')) return;
    startBusy(async () => {
      const res = await deleteOAuthApp(id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setApps((prev) => prev.filter((a) => a._id !== id));
    });
  };

  return (
    <div className="space-y-4">
      {secret ? (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" />
          <div className="space-y-2">
            <p className="font-semibold text-sm">Save this client secret — shown once.</p>
            <p className="text-xs">Configure it alongside the client_id in your OAuth client.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-zoru-surface border border-zoru-line rounded px-3 py-2 text-zoru-ink overflow-x-auto">
                {secret}
              </code>
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(secret)}>
                <Copy className="h-3 w-3 mr-1" /> Copy
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSecret(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </Alert>
      ) : null}

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Register OAuth app</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Redirect URIs (one per line)</Label>
              <Textarea
                value={redirects}
                onChange={(e) => setRedirects(e.target.value)}
                rows={2}
                placeholder="https://yourapp.com/oauth/callback"
                className="font-mono"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Requested scopes (space-separated)</Label>
              <Input
                value={scopes}
                onChange={(e) => setScopes(e.target.value)}
                className="font-mono"
                disabled={busy}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleCreate} disabled={busy || !name.trim()}>
              {busy ? 'Working…' : 'Register'}
            </Button>
          </div>
        </ZoruCardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      ) : null}

      {apps.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-8 w-8" />}
          title="No OAuth apps yet"
          description="Register an app above to get started."
        />
      ) : (
        <div className="space-y-3">
          {apps.map((a) => (
            <Card key={a._id}>
              <ZoruCardContent className="pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zoru-ink">{a.name}</p>
                    {a.description ? (
                      <p className="text-xs text-zoru-ink-muted mt-0.5">{a.description}</p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(a._id)}
                    disabled={busy}
                    className="text-zoru-danger hover:text-zoru-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Separator className="my-3" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-zoru-ink-subtle mb-0.5">Client ID</p>
                    <code className="font-mono text-zoru-ink">{a.clientId}</code>
                  </div>
                  <div>
                    <p className="text-zoru-ink-subtle mb-0.5">Created</p>
                    <p className="text-zoru-ink">{new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-zoru-ink-subtle mb-0.5">Redirect URIs</p>
                    <ul className="font-mono text-zoru-ink space-y-0.5">
                      {a.redirectUris.map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-zoru-ink-subtle mb-0.5">Allowed scopes</p>
                    <code className="font-mono text-zoru-ink">{a.scopes.join(' ')}</code>
                  </div>
                </div>
                
                <Separator className="my-3" />
                
                <div className="bg-zoru-surface-2/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-3 text-sm font-medium text-zoru-ink">
                    <BarChart2 className="h-4 w-4 text-zoru-brand" />
                    Usage & Rate Limit
                  </div>
                  
                  <div className="space-y-4 text-xs">
                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <p className="text-zoru-ink-subtle">API Requests (30d)</p>
                        <p className="text-zoru-ink font-medium">
                          {usageData.find((u) => u.keyId === a.clientId)?.count || 0} / 10,000
                        </p>
                      </div>
                      <Progress 
                        value={Math.min(100, ((usageData.find((u) => u.keyId === a.clientId)?.count || 0) / 10000) * 100)} 
                        className="h-2" 
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-zoru-ink-subtle mb-1">Status</p>
                        <Badge 
                          variant={((usageData.find((u) => u.keyId === a.clientId)?.count || 0) >= 10000) ? 'danger' : 'success'}
                        >
                          {((usageData.find((u) => u.keyId === a.clientId)?.count || 0) >= 10000) ? 'Rate Limited' : 'Active'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-zoru-ink-subtle mb-1">Errors (30d)</p>
                        <p className={`font-medium ${(usageData.find((u) => u.keyId === a.clientId)?.errorCount || 0) > 0 ? 'text-zoru-ink' : 'text-zoru-ink'}`}>
                          {usageData.find((u) => u.keyId === a.clientId)?.errorCount || 0}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-zoru-ink-subtle mb-1">Last used</p>
                        <p className="text-zoru-ink font-medium">
                          {usageData.find((u) => u.keyId === a.clientId)?.lastUsedAt 
                            ? new Date(usageData.find((u) => u.keyId === a.clientId)?.lastUsedAt as string).toLocaleString() 
                            : 'Never'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </ZoruCardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
