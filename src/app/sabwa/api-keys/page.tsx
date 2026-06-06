'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Checkbox, DatePicker, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Label, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import {
  format,
  formatDistanceToNow } from 'date-fns';
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

/**
 * /sabwa/api-keys — Generate and revoke REST API keys scoped to SabWa.
 *
 * Table of keys with prefix, scopes, status. Generate dialog with scope
 * multi-select. After generate, full key is shown once with copy button
 * and explicit warning.
 *
 * Visual layer migrated to ZoruUI.
 */

import * as React from 'react';
import Link from 'next/link';

import { EmptyState } from '@/app/sabwa/_components/empty-state';
import { useProject } from '@/context/project-context';

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
): 'secondary' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'active':
      return 'success';
    case 'revoked':
      return 'danger';
    case 'expired':
      return 'warning';
    default:
      return 'secondary';
  }
}

export default function ApiKeysPage() {
  const toast = useToast();
  const { activeProjectId } = useProject();
  const [rows, setRows] = React.useState<SabwaApiKeyRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [reveal, setReveal] = React.useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] =
    React.useState<SabwaApiKeyRow | null>(null);

  const load = React.useCallback(async () => {
    if (!activeProjectId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const res = await listApiKeys(activeProjectId);
      if (res.ok) setRows(res.apiKeys);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleRevoke = React.useCallback(async () => {
    if (!pendingRevoke) return;
    try {
      const res = await revokeApiKey(pendingRevoke.id);
      if (!res.ok) {
        toast.toast({
          title: 'Could not revoke',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast.toast({ title: 'Key revoked' });
      setPendingRevoke(null);
      await load();
    } catch (err) {
      toast.toast({
        title: 'Could not reach engine',
        description: err instanceof Error ? err.message : 'Try again later.',
      });
      setPendingRevoke(null);
    }
  }, [pendingRevoke, toast, load]);

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/sabwa">SabWa</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>API keys</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[24px] leading-[1.2] tracking-[-0.015em] text-[var(--st-text)]">
              API Keys
            </h1>
            <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
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
            className="gap-1.5 text-[var(--st-text-secondary)]"
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
            className="gap-1.5"
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
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Generate new key
              </Button>
            </DialogTrigger>
            <CreateApiKeyDialogContent
              projectId={activeProjectId}
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
        <CardBody>
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
                <THead>
                  <Tr>
                    <Th>Prefix</Th>
                    <Th>Scopes</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                    <Th>Last used</Th>
                    <Th>Expires</Th>
                    <Th className="text-right">
                      Actions
                    </Th>
                  </Tr>
                </THead>
                <TBody>
                  {rows.map((row) => (
                    <Tr key={row.id}>
                      <Td className="font-mono text-xs">
                        {row.prefix}
                      </Td>
                      <Td>
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
                      </Td>
                      <Td>
                        <Badge variant={statusVariant(row.status)}>
                          {row.status}
                        </Badge>
                      </Td>
                      <Td>
                        <span title={format(new Date(row.createdAt), 'PPpp')}>
                          {formatDistanceToNow(new Date(row.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </Td>
                      <Td>
                        {row.lastUsedAt ? (
                          <span
                            title={format(new Date(row.lastUsedAt), 'PPpp')}
                          >
                            {formatDistanceToNow(new Date(row.lastUsedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        ) : (
                          <span className="text-[var(--st-text-secondary)]">Never</span>
                        )}
                      </Td>
                      <Td>
                        {row.expiresAt ? (
                          <span title={format(new Date(row.expiresAt), 'PPpp')}>
                            {formatDistanceToNow(new Date(row.expiresAt), {
                              addSuffix: true,
                            })}
                          </span>
                        ) : (
                          <span className="text-[var(--st-text-secondary)]">No expiry</span>
                        )}
                      </Td>
                      <Td className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-[var(--st-danger)] hover:text-[var(--st-danger)]"
                          disabled={row.status !== 'active'}
                          onClick={() => setPendingRevoke(row)}
                        >
                          <ShieldOff className="h-3.5 w-3.5" />
                          Revoke
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </CardBody>
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
              className="bg-[var(--st-danger)] text-[var(--st-text-inverted)] hover:bg-[var(--st-danger)]/90"
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
  projectId,
  onCreated,
}: {
  projectId: string | null;
  onCreated: (apiKey: string) => void | Promise<void>;
}) {
  const toast = useToast();
  const [scopes, setScopes] = React.useState<string[]>(['messages.send']);
  const [expiresAt, setExpiresAt] = React.useState<Date | undefined>();
  const [submitting, setSubmitting] = React.useState(false);

  const toggle = (s: string) =>
    setScopes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  const submit = async () => {
    if (scopes.length === 0) {
      toast.toast({
        title: 'Pick at least one scope',
        variant: 'destructive',
      });
      return;
    }
    if (!projectId) {
      toast.toast({
        title: 'No active project',
        description: 'Select a project before generating an API key.',
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await createApiKey({
        projectId,
        scopes,
        expiresAt,
      });
      if (!res.ok) {
        toast.toast({
          title: 'Could not generate key',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      await onCreated(res.apiKey);
    } catch (err) {
      toast.toast({
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
                className="flex cursor-pointer items-start gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)]"
              >
                <Checkbox
                  id={`scope-${s.value}`}
                  checked={scopes.includes(s.value)}
                  onCheckedChange={() => toggle(s.value)}
                  className="mt-0.5"
                />
                <div className="flex flex-col">
                  <span className="font-mono text-xs">{s.label}</span>
                  <span className="text-[11px] text-[var(--st-text-secondary)]">
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
            value={expiresAt}
            onChange={setExpiresAt}
            placeholder="No expiry"
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
  const toast = useToast();
  return (
    <Card className="border-[var(--st-warn)]/40 bg-[var(--st-warn)]/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-[var(--st-text)]">
          <AlertTriangle className="h-4 w-4 text-[var(--st-warn)]" />
          New API key — copy now
        </CardTitle>
        <CardDescription>
          This is the only time you&apos;ll see the full key. Store it in your
          secrets manager before dismissing.
        </CardDescription>
      </CardHeader>
      <CardBody className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-2.5 py-1.5 text-xs text-[var(--st-text)]">
          {apiKey}
        </code>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(apiKey);
            toast.toast({ title: 'Copied key to clipboard' });
          }}
          className="gap-1.5"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </CardBody>
    </Card>
  );
}
