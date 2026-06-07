'use client';

import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Checkbox, DatePicker, Input, Label, RadioGroup, RadioGroupItem, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import { format, formatDistanceToNow } from 'date-fns';
import { Download, FileArchive, Loader2, Play, RefreshCw, RotateCcw, Smartphone } from 'lucide-react';

import { createExport, listExports, type SabwaExportFormat, type SabwaExportRow, type SabwaExportScope, type SabwaExportStatus } from '@/app/actions/sabwa.actions';
import { useSabwaSession } from '@/lib/sabwa/session-context';
import { formatJid, useResolveJid } from '@/lib/sabwa/format-jid';

/**
 * /sabwa/export — Two-column export configurator + history of past exports.
 *
 * Configurator (left): scope, format, include-media, "Run export".
 * History (right): status, format, size, created, download link, expires.
 *
 * Visual layer migrated to Ui20. Scope picker uses a segmented
 * Button group (no tab UI).
 */

import * as React from 'react';
import Link from 'next/link';

import { EmptyState } from '@/app/sabwa/_components/empty-state';

type ScopeKind = SabwaExportScope['kind'];

const SCOPE_OPTIONS: { value: ScopeKind; label: string }[] = [
  { value: 'all', label: 'All chats' },
  { value: 'chats', label: 'Specific chats' },
  { value: 'date_range', label: 'Date range' },
];

const FORMAT_LABELS: Record<SabwaExportFormat, string> = {
  json: 'JSON',
  csv: 'CSV',
  txt: 'WhatsApp .txt',
  pdf: 'PDF',
};

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function statusVariant(
  status: SabwaExportStatus,
): 'secondary' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'ready':
      return 'success';
    case 'running':
    case 'queued':
      return 'warning';
    case 'failed':
    case 'expired':
      return 'danger';
    default:
      return 'secondary';
  }
}

export default function ExportPage() {
  const toast = useToast();
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? '';
  const resolve = useResolveJid(sessionId);

  // Configurator state
  const [scopeKind, setScopeKind] = React.useState<ScopeKind>('all');
  const [jidsRaw, setJidsRaw] = React.useState('');
  const [from, setFrom] = React.useState<Date | undefined>();
  const [to, setTo] = React.useState<Date | undefined>();
  const [fmt, setFmt] = React.useState<SabwaExportFormat>('json');
  const [includeMedia, setIncludeMedia] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // History state
  const [exports, setExports] = React.useState<SabwaExportRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const loadHistory = React.useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await listExports(sessionId);
      if (res.ok) setExports(res.exports);
    } catch {
      // ignore — engine offline; keep current list
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const buildScope = React.useCallback((): SabwaExportScope => {
    if (scopeKind === 'chats') {
      const jids = jidsRaw
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      return { kind: 'chats', jids };
    }
    if (scopeKind === 'date_range') {
      return { kind: 'date_range', from, to };
    }
    return { kind: 'all' };
  }, [scopeKind, jidsRaw, from, to]);

  const runExport = React.useCallback(
    async (
      overrideScope?: SabwaExportScope,
      overrideFmt?: SabwaExportFormat,
    ) => {
      setSubmitting(true);
      try {
        const res = await createExport({
          sessionId,
          scope: overrideScope ?? buildScope(),
          format: overrideFmt ?? fmt,
          includeMedia,
        });
        if (!res.ok) {
          toast.toast({
            title: 'Export failed',
            description: res.error,
            variant: 'destructive',
          });
          return;
        }
        toast.toast({
          title: 'Export queued',
          description:
            'Your export is running in the background. You will see it appear in the history shortly.',
        });
        await loadHistory();
      } catch (err) {
        toast.toast({
          title: 'Export queued',
          description:
            err instanceof Error
              ? err.message
              : 'Could not reach the engine yet — try again once the worker is online.',
        });
      } finally {
        setSubmitting(false);
      }
    },
    [sessionId, buildScope, fmt, includeMedia, toast, loadHistory],
  );

  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
        <EmptyState
          icon={<Smartphone />}
          title="No active WhatsApp account"
          description="Pick a connected account on the SabWa overview to start using this page."
          action={
            <Link href="/sabwa/overview">
              <Button size="md">Open accounts</Button>
            </Link>
          }
        />
      </div>
    );
  }

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
            <BreadcrumbPage>Export</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
          <Download className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-[24px] leading-[1.2] tracking-[-0.015em] text-[var(--st-text)]">
            Export / Backup
          </h1>
          <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
            Run background exports of selected chats and download from a signed
            R2 link when ready.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Configurator */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">New export</CardTitle>
            <CardDescription>
              Choose scope, format, and whether to bundle media.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                Scope
              </Label>
              <div
                role="group"
                aria-label="Export scope"
                className="inline-flex flex-wrap gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1"
              >
                {SCOPE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    size="sm"
                    variant={scopeKind === opt.value ? 'default' : 'ghost'}
                    onClick={() => setScopeKind(opt.value)}
                    className="rounded-[calc(var(--st-radius)-2px)]"
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              {scopeKind === 'chats' ? (
                <div className="space-y-1">
                  <Input
                    placeholder="Comma- or newline-separated JIDs"
                    value={jidsRaw}
                    onChange={(e) => setJidsRaw(e.target.value)}
                  />
                  <p className="text-[11px] text-[var(--st-text-secondary)]">
                    Paste JIDs directly to include them in this export.
                  </p>
                  {(() => {
                    const pasted = jidsRaw
                      .split(/[\n,]/)
                      .map((s) => s.trim())
                      .filter(Boolean);
                    if (pasted.length === 0) return null;
                    return (
                      <ul className="mt-1 max-h-32 overflow-y-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-2 text-[11px]">
                        {pasted.map((jid) => {
                          const resolved = resolve(jid);
                          const pretty = formatJid(jid);
                          return (
                            <li
                              key={jid}
                              className="flex items-center gap-2 py-0.5"
                            >
                              <span className="truncate text-[var(--st-text)]">
                                {resolved}
                              </span>
                              {resolved !== pretty && (
                                <span className="truncate font-mono text-[10px] text-[var(--st-text-secondary)]">
                                  · {pretty}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    );
                  })()}
                </div>
              ) : null}
              {scopeKind === 'date_range' ? (
                <div className="grid grid-cols-2 gap-2">
                  <DatePicker
                    value={from}
                    onChange={setFrom}
                    placeholder="From"
                  />
                  <DatePicker
                    value={to}
                    onChange={setTo}
                    placeholder="To"
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                Format
              </Label>
              <RadioGroup
                value={fmt}
                onValueChange={(v) => setFmt(v as SabwaExportFormat)}
                className="grid grid-cols-2 gap-2"
              >
                {(Object.keys(FORMAT_LABELS) as SabwaExportFormat[]).map(
                  (key) => (
                    <Label
                      key={key}
                      htmlFor={`fmt-${key}`}
                      className="flex cursor-pointer items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)]"
                    >
                      <RadioGroupItem id={`fmt-${key}`} value={key} />
                      <span>{FORMAT_LABELS[key]}</span>
                    </Label>
                  ),
                )}
              </RadioGroup>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="include-media"
                checked={includeMedia}
                onCheckedChange={(v) => setIncludeMedia(v === true)}
              />
              <Label
                htmlFor="include-media"
                className="text-sm font-normal leading-tight"
              >
                Include media attachments
                <span className="mt-0.5 block text-[11px] text-[var(--st-text-secondary)]">
                  Bundled into the archive — file size can grow quickly.
                </span>
              </Label>
            </div>

            <Button
              onClick={() => void runExport()}
              disabled={submitting}
              block
              className="gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run export
            </Button>
          </CardBody>
        </Card>

        {/* History */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Past exports</CardTitle>
              <CardDescription>
                R2 download links expire — re-run any row with one click.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadHistory()}
              disabled={loading}
              className="gap-1.5"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
          </CardHeader>
          <CardBody>
            {exports.length === 0 ? (
              <EmptyState
                icon={FileArchive}
                title="No exports yet"
                description="Once you run an export it will appear here with a signed download link."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <Tr>
                      <Th>Status</Th>
                      <Th>Format</Th>
                      <Th>Size</Th>
                      <Th>Created</Th>
                      <Th>Expires</Th>
                      <Th className="text-right">
                        Actions
                      </Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {exports.map((row) => {
                      const created = new Date(row.createdAt);
                      const expires = row.expiresAt
                        ? new Date(row.expiresAt)
                        : null;
                      return (
                        <Tr key={row.id}>
                          <Td>
                            <Badge variant={statusVariant(row.status)}>
                              {row.status}
                            </Badge>
                          </Td>
                          <Td className="font-mono text-xs uppercase">
                            {FORMAT_LABELS[row.format]}
                          </Td>
                          <Td className="tabular-nums">
                            {formatBytes(row.sizeBytes)}
                          </Td>
                          <Td>
                            <span title={format(created, 'PPpp')}>
                              {formatDistanceToNow(created, {
                                addSuffix: true,
                              })}
                            </span>
                          </Td>
                          <Td>
                            {expires ? (
                              <span title={format(expires, 'PPpp')}>
                                {formatDistanceToNow(expires, {
                                  addSuffix: true,
                                })}
                              </span>
                            ) : (
                              '—'
                            )}
                          </Td>
                          <Td className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {row.status === 'ready' && row.downloadUrl ? (
                                <Button
                                  asChild
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5"
                                >
                                  <a
                                    href={row.downloadUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    Download
                                  </a>
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1.5"
                                onClick={() =>
                                  void runExport(row.scope, row.format)
                                }
                                disabled={submitting}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Re-run
                              </Button>
                            </div>
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
