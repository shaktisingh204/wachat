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
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Checkbox,
  DatePicker,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Label,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
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
  const toast = useZoruToast();
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
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/sabwa">SabWa</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>API keys</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
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
            <ZoruDialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Generate new key
              </Button>
            </ZoruDialogTrigger>
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
        <ZoruCardHeader>
          <ZoruCardTitle className="text-base">Active keys</ZoruCardTitle>
          <ZoruCardDescription>
            Scopes restrict what an API key can do. Revoke any key with one
            click.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
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
                <ZoruTableHeader>
                  <ZoruTableRow>
                    <ZoruTableHead>Prefix</ZoruTableHead>
                    <ZoruTableHead>Scopes</ZoruTableHead>
                    <ZoruTableHead>Status</ZoruTableHead>
                    <ZoruTableHead>Created</ZoruTableHead>
                    <ZoruTableHead>Last used</ZoruTableHead>
                    <ZoruTableHead>Expires</ZoruTableHead>
                    <ZoruTableHead className="text-right">
                      Actions
                    </ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {rows.map((row) => (
                    <ZoruTableRow key={row.id}>
                      <ZoruTableCell className="font-mono text-xs">
                        {row.prefix}
                      </ZoruTableCell>
                      <ZoruTableCell>
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
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <Badge variant={statusVariant(row.status)}>
                          {row.status}
                        </Badge>
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <span title={format(new Date(row.createdAt), 'PPpp')}>
                          {formatDistanceToNow(new Date(row.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </ZoruTableCell>
                      <ZoruTableCell>
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
                      </ZoruTableCell>
                      <ZoruTableCell>
                        {row.expiresAt ? (
                          <span title={format(new Date(row.expiresAt), 'PPpp')}>
                            {formatDistanceToNow(new Date(row.expiresAt), {
                              addSuffix: true,
                            })}
                          </span>
                        ) : (
                          <span className="text-[var(--st-text-secondary)]">No expiry</span>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
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
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))}
                </ZoruTableBody>
              </Table>
            </div>
          )}
        </ZoruCardContent>
      </Card>

      <ZoruAlertDialog
        open={pendingRevoke !== null}
        onOpenChange={(o) => !o && setPendingRevoke(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Revoke this API key?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Any service using <code>{pendingRevoke?.prefix}</code> will stop
              working immediately. This cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={() => void handleRevoke()}
              className="bg-[var(--st-danger)] text-[var(--st-text-inverted)] hover:bg-[var(--st-danger)]/90"
            >
              Revoke
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
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
  const toast = useZoruToast();
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
    <ZoruDialogContent className="sm:max-w-[480px]">
      <ZoruDialogHeader>
        <ZoruDialogTitle>Generate new API key</ZoruDialogTitle>
        <ZoruDialogDescription>
          Choose scopes and an optional expiry. The full key is shown once.
        </ZoruDialogDescription>
      </ZoruDialogHeader>
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
      <ZoruDialogFooter>
        <Button onClick={() => void submit()} disabled={submitting}>
          {submitting ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : null}
          Generate key
        </Button>
      </ZoruDialogFooter>
    </ZoruDialogContent>
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
  const toast = useZoruToast();
  return (
    <Card className="border-[var(--st-warn)]/40 bg-[var(--st-warn)]/5">
      <ZoruCardHeader>
        <ZoruCardTitle className="flex items-center gap-2 text-base text-[var(--st-text)]">
          <AlertTriangle className="h-4 w-4 text-[var(--st-warn)]" />
          New API key — copy now
        </ZoruCardTitle>
        <ZoruCardDescription>
          This is the only time you&apos;ll see the full key. Store it in your
          secrets manager before dismissing.
        </ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent className="flex items-center gap-2">
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
      </ZoruCardContent>
    </Card>
  );
}
