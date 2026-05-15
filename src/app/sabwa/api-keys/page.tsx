'use client';

/**
 * /sabwa/api-keys — Generate and revoke REST API keys scoped to SabWa.
 *
 * Table of keys with prefix, scopes, status. Generate dialog with scope
 * multi-select. After generate, full key is shown once with copy button
 * and explicit warning.
 */

import * as React from 'react';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  Book,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  ShieldOff,
} from 'lucide-react';

import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type SabwaApiKeyRow,
  type SabwaApiKeyStatus,
} from '@/app/actions/sabwa.actions';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

import { EmptyState } from '@/app/sabwa/_components/empty-state';

const STUB_PROJECT_ID = 'stub-project';

const ALL_SCOPES: { value: string; label: string; description: string }[] = [
  {
    value: 'messages.send',
    label: 'messages.send',
    description: 'Send messages, broadcasts, and scheduled jobs.',
  },
  {
    value: 'chats.read',
    label: 'chats.read',
    description: 'Read chats, messages, and contacts.',
  },
  {
    value: 'groups.manage',
    label: 'groups.manage',
    description: 'Create groups, manage participants and admins.',
  },
  {
    value: '*',
    label: '*  (full access)',
    description: 'All current and future SabWa scopes — handle with care.',
  },
];

function statusVariant(
  status: SabwaApiKeyStatus,
): 'secondary' | 'success' | 'warning' | 'destructive' {
  switch (status) {
    case 'active':
      return 'success';
    case 'revoked':
      return 'destructive';
    case 'expired':
      return 'warning';
    default:
      return 'secondary';
  }
}

export default function ApiKeysPage() {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<SabwaApiKeyRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [reveal, setReveal] = React.useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] =
    React.useState<SabwaApiKeyRow | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listApiKeys(STUB_PROJECT_ID);
      if (res.ok) setRows(res.apiKeys);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleRevoke = React.useCallback(async () => {
    if (!pendingRevoke) return;
    try {
      const res = await revokeApiKey(pendingRevoke.id);
      if (!res.ok) {
        toast({
          title: 'Could not revoke',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Key revoked' });
      setPendingRevoke(null);
      await load();
    } catch (err) {
      toast({
        title: 'Could not reach engine',
        description: err instanceof Error ? err.message : 'Try again later.',
      });
      setPendingRevoke(null);
    }
  }, [pendingRevoke, toast, load]);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-secondary p-3">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              REST tokens scoped to the SabWa module. Reuses the dashboard API
              pattern.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="h-9 gap-1.5 text-muted-foreground"
          >
            <Link href="/dashboard/api/docs#sabwa">
              <Book className="h-4 w-4" />
              API docs
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="h-9 gap-1.5"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 gap-1.5">
                <Plus className="h-4 w-4" />
                Generate new key
              </Button>
            </DialogTrigger>
            <CreateApiKeyDialogContent
              onCreated={async (key) => {
                setCreateOpen(false);
                setReveal(key);
                await load();
              }}
            />
          </Dialog>
        </div>
      </div>

      {reveal ? (
        <KeyRevealCard apiKey={reveal} onDismiss={() => setReveal(null)} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active keys</CardTitle>
          <CardDescription>
            Scopes restrict what an API key can do. Revoke any key with one
            click.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="No API keys yet"
              description="Generate a key to call the SabWa REST API from outside the dashboard."
              action={
                <Button
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Generate new key
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">
                        {row.prefix}
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-[260px] flex-wrap gap-1">
                          {row.scopes.map((s) => (
                            <Badge
                              key={s}
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(row.status)}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span title={format(new Date(row.createdAt), 'PPpp')}>
                          {formatDistanceToNow(new Date(row.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </TableCell>
                      <TableCell>
                        {row.lastUsedAt ? (
                          <span
                            title={format(new Date(row.lastUsedAt), 'PPpp')}
                          >
                            {formatDistanceToNow(new Date(row.lastUsedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.expiresAt ? (
                          <span title={format(new Date(row.expiresAt), 'PPpp')}>
                            {formatDistanceToNow(new Date(row.expiresAt), {
                              addSuffix: true,
                            })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No expiry</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1.5 text-destructive hover:text-destructive"
                          disabled={row.status !== 'active'}
                          onClick={() => setPendingRevoke(row)}
                        >
                          <ShieldOff className="h-3.5 w-3.5" />
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingRevoke !== null}
        onOpenChange={(o) => !o && setPendingRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this API key?</AlertDialogTitle>
            <AlertDialogDescription>
              Any service using <code>{pendingRevoke?.prefix}</code> will stop
              working immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleRevoke()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Generate dialog ───────────────────────────────────────────────────────

function CreateApiKeyDialogContent({
  onCreated,
}: {
  onCreated: (apiKey: string) => void | Promise<void>;
}) {
  const { toast } = useToast();
  const [scopes, setScopes] = React.useState<string[]>(['messages.send']);
  const [expiresAt, setExpiresAt] = React.useState<Date | undefined>();
  const [submitting, setSubmitting] = React.useState(false);

  const toggle = (s: string) =>
    setScopes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  const submit = async () => {
    if (scopes.length === 0) {
      toast({
        title: 'Pick at least one scope',
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await createApiKey({
        projectId: STUB_PROJECT_ID,
        scopes,
        expiresAt,
      });
      if (!res.ok) {
        toast({
          title: 'Could not generate key',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      await onCreated(res.apiKey);
    } catch (err) {
      toast({
        title: 'Could not reach engine',
        description: err instanceof Error ? err.message : 'Try again later.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>Generate new API key</DialogTitle>
        <DialogDescription>
          Choose scopes and an optional expiry. The full key is shown once.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Scopes</Label>
          <div className="space-y-1.5">
            {ALL_SCOPES.map((s) => (
              <Label
                key={s.value}
                htmlFor={`scope-${s.value}`}
                className="flex cursor-pointer items-start gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:bg-accent"
              >
                <Checkbox
                  id={`scope-${s.value}`}
                  checked={scopes.includes(s.value)}
                  onCheckedChange={() => toggle(s.value)}
                  className="mt-0.5"
                />
                <div className="flex flex-col">
                  <span className="font-mono text-xs">{s.label}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {s.description}
                  </span>
                </div>
              </Label>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Expires at (optional)</Label>
          <DatePicker
            date={expiresAt}
            setDate={setExpiresAt}
            placeholder="No expiry"
            className="h-9"
          />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => void submit()} disabled={submitting}>
          {submitting ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : null}
          Generate key
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Key reveal card ───────────────────────────────────────────────────────

function KeyRevealCard({
  apiKey,
  onDismiss,
}: {
  apiKey: string;
  onDismiss: () => void;
}) {
  const { toast } = useToast();
  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          New API key — copy now
        </CardTitle>
        <CardDescription>
          This is the only time you&apos;ll see the full key. Store it in your
          secrets manager before dismissing.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border bg-background px-2.5 py-1.5 text-xs">
          {apiKey}
        </code>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(apiKey);
            toast({ title: 'Copied key to clipboard' });
          }}
          className="gap-1.5"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </CardContent>
    </Card>
  );
}
