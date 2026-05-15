'use client';

/**
 * /sabwa/export — Two-column export configurator + history of past exports.
 *
 * Configurator (left): scope, format, include-media, "Run export".
 * History (right): status, format, size, created, download link, expires.
 */

import * as React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Download,
  FileArchive,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';

import {
  createExport,
  listExports,
  type SabwaExportFormat,
  type SabwaExportRow,
  type SabwaExportScope,
  type SabwaExportStatus,
} from '@/app/actions/sabwa.actions';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const STUB_SESSION_ID = 'stub-primary';

type ScopeKind = SabwaExportScope['kind'];

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
): 'secondary' | 'success' | 'warning' | 'destructive' {
  switch (status) {
    case 'ready':
      return 'success';
    case 'running':
    case 'queued':
      return 'warning';
    case 'failed':
    case 'expired':
      return 'destructive';
    default:
      return 'secondary';
  }
}

export default function ExportPage() {
  const { toast } = useToast();

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
    setLoading(true);
    try {
      const res = await listExports(STUB_SESSION_ID);
      if (res.ok) setExports(res.exports);
    } catch {
      // ignore — engine offline; keep current list
    } finally {
      setLoading(false);
    }
  }, []);

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
    async (overrideScope?: SabwaExportScope, overrideFmt?: SabwaExportFormat) => {
      setSubmitting(true);
      try {
        const res = await createExport({
          sessionId: STUB_SESSION_ID,
          scope: overrideScope ?? buildScope(),
          format: overrideFmt ?? fmt,
          includeMedia,
        });
        if (!res.ok) {
          toast({
            title: 'Export failed',
            description: res.error,
            variant: 'destructive',
          });
          return;
        }
        toast({
          title: 'Export queued',
          description:
            'Your export is running in the background. You will see it appear in the history shortly.',
        });
        await loadHistory();
      } catch (err) {
        toast({
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
    [buildScope, fmt, includeMedia, toast, loadHistory],
  );

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Download className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Export / Backup
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
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
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Scope
              </Label>
              <Select
                value={scopeKind}
                onValueChange={(v) => setScopeKind(v as ScopeKind)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All chats</SelectItem>
                  <SelectItem value="chats">Specific chats</SelectItem>
                  <SelectItem value="date_range">Date range</SelectItem>
                </SelectContent>
              </Select>
              {scopeKind === 'chats' ? (
                <div className="space-y-1">
                  <Input
                    placeholder="Comma- or newline-separated JIDs"
                    value={jidsRaw}
                    onChange={(e) => setJidsRaw(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Phase 1: paste JIDs directly. Inbox-based picker coming
                    once chat list lands.
                  </p>
                </div>
              ) : null}
              {scopeKind === 'date_range' ? (
                <div className="grid grid-cols-2 gap-2">
                  <DatePicker
                    date={from}
                    setDate={setFrom}
                    placeholder="From"
                    className="h-9"
                  />
                  <DatePicker
                    date={to}
                    setDate={setTo}
                    placeholder="To"
                    className="h-9"
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
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
                      className="flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:bg-accent"
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
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  Bundled into the archive — file size can grow quickly.
                </span>
              </Label>
            </div>

            <Button
              onClick={() => void runExport()}
              disabled={submitting}
              className="w-full gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run export
            </Button>
          </CardContent>
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
              className="h-8 gap-1.5"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {exports.length === 0 ? (
              <EmptyState
                icon={FileArchive}
                title="No exports yet"
                description="Once you run an export it will appear here with a signed download link."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exports.map((row) => {
                      const created = new Date(row.createdAt);
                      const expires = row.expiresAt
                        ? new Date(row.expiresAt)
                        : null;
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Badge variant={statusVariant(row.status)}>
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs uppercase">
                            {FORMAT_LABELS[row.format]}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatBytes(row.sizeBytes)}
                          </TableCell>
                          <TableCell>
                            <span title={format(created, 'PPpp')}>
                              {formatDistanceToNow(created, {
                                addSuffix: true,
                              })}
                            </span>
                          </TableCell>
                          <TableCell>
                            {expires ? (
                              <span title={format(expires, 'PPpp')}>
                                {formatDistanceToNow(expires, {
                                  addSuffix: true,
                                })}
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {row.status === 'ready' && row.downloadUrl ? (
                                <Button
                                  asChild
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1.5"
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
                                className="h-8 gap-1.5"
                                onClick={() =>
                                  void runExport(row.scope, row.format)
                                }
                                disabled={submitting}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Re-run
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
