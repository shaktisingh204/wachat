'use client';

/**
 * FacebookWebhookLogs (local, ZoruUI).
 *
 * Local replacement for @/components/wabasimplify/webhook-logs scoped to
 * the Meta Suite. Same server actions (getWebhookLogs,
 * handleClearProcessedLogs, handleReprocessWebhook,
 * getWebhookLogPayload), same pagination + reprocess + view-payload
 * behaviour. All visuals come from ZoruUI primitives.
 *
 * Adds three Meta-Suite-flavoured dialogs surfaced from the toolbar:
 *   - create-webhook  (TODO — currently informational; Meta webhook
 *                      subscription endpoints are configured at the
 *                      project level and the create-flow on this page
 *                      is stubbed pending a dedicated server action)
 *   - test-webhook    (re-uses handleReprocessWebhook on the most recent
 *                      log entry — equivalent to a "send test event")
 *   - delete-webhook  (destructive ZoruAlertDialog wrapping
 *                      handleClearProcessedLogs)
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import {
  AlertCircle,
  Copy,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  TestTube,
  Trash2,
} from 'lucide-react';

import {
  getWebhookLogPayload,
  getWebhookLogs,
  handleClearProcessedLogs,
} from '@/app/actions/index.ts';
import { handleReprocessWebhook } from '@/app/actions/webhook.actions';
import type { WebhookLogListItem } from '@/lib/definitions';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertTitle,
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';

const LOGS_PER_PAGE = 15;

function ReprocessButton({
  logId,
  onReprocessComplete,
}: {
  logId: string;
  onReprocessComplete: () => void;
}) {
  const [isProcessing, startTransition] = useTransition();
  const { toast } = useZoruToast();

  const onReprocess = () => {
    startTransition(async () => {
      const result = await handleReprocessWebhook(logId);
      if (result.error) {
        toast({
          title: 'Error re-processing',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Success', description: result.message });
        onReprocessComplete();
      }
    });
  };

  return (
    <ZoruButton
      variant="ghost"
      size="icon-sm"
      onClick={onReprocess}
      disabled={isProcessing}
      aria-label="Re-process webhook"
    >
      {isProcessing ? <Loader2 className="animate-spin" /> : <RotateCw />}
    </ZoruButton>
  );
}

interface FacebookWebhookLogsProps {
  filterByProject?: boolean;
}

export function FacebookWebhookLogs({
  filterByProject = false,
}: FacebookWebhookLogsProps) {
  const [logs, setLogs] = useState<WebhookLogListItem[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const [isClearing, startClearingTransition] = useTransition();
  const [isTesting, startTestingTransition] = useTransition();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useZoruToast();

  const [selectedLog, setSelectedLog] = useState<WebhookLogListItem | null>(
    null,
  );
  const [selectedLogPayload, setSelectedLogPayload] = useState<any | null>(
    null,
  );
  const [loadingPayload, setLoadingPayload] = useState(false);

  // Top-level dialog state.
  const [createOpen, setCreateOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (filterByProject) {
      const storedProjectId = localStorage.getItem('activeProjectId');
      setProjectId(storedProjectId);
    }
  }, [filterByProject]);

  const fetchLogs = useCallback(
    async (page: number, query: string, showToast = false) => {
      const idToFetch = filterByProject ? projectId : null;

      if (filterByProject && !projectId) {
        setLogs([]);
        setTotalPages(0);
        return;
      }

      startLoadingTransition(async () => {
        try {
          const { logs: newLogs, total } = await getWebhookLogs(
            idToFetch,
            page,
            LOGS_PER_PAGE,
            query,
          );
          setLogs(newLogs);
          setTotalPages(Math.ceil(total / LOGS_PER_PAGE));
          if (showToast) {
            toast({ title: 'Refreshed', description: 'Webhook logs updated.' });
          }
        } catch (error) {
          toast({
            title: 'Error',
            description: 'Failed to fetch webhook logs.',
            variant: 'destructive',
          });
        }
      });
    },
    [projectId, toast, filterByProject],
  );

  useEffect(() => {
    if (isClient) {
      if (filterByProject && !projectId) return;
      fetchLogs(currentPage, searchQuery);
    }
  }, [
    currentPage,
    searchQuery,
    fetchLogs,
    isClient,
    projectId,
    filterByProject,
  ]);

  const handleSearch = useDebouncedCallback((term: string) => {
    setSearchQuery(term);
    setCurrentPage(1);
  }, 300);

  const handleClearLogs = () => {
    startClearingTransition(async () => {
      const result = await handleClearProcessedLogs();
      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Success', description: result.message });
        fetchLogs(1, searchQuery, false);
        setCurrentPage(1);
        setDeleteOpen(false);
      }
    });
  };

  const handleTestWebhook = () => {
    if (logs.length === 0) {
      toast({
        title: 'No log to replay',
        description:
          'Receive at least one webhook event before sending a test re-process.',
        variant: 'destructive',
      });
      setTestOpen(false);
      return;
    }
    startTestingTransition(async () => {
      const result = await handleReprocessWebhook(logs[0]._id.toString());
      if (result.error) {
        toast({
          title: 'Test failed',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Test sent',
          description: result.message ?? 'Webhook re-processed.',
        });
        fetchLogs(currentPage, searchQuery, false);
      }
      setTestOpen(false);
    });
  };

  const handleViewLog = async (log: WebhookLogListItem) => {
    setSelectedLog(log);
    setSelectedLogPayload(null);
    setLoadingPayload(true);
    const payload = await getWebhookLogPayload(log._id);
    setSelectedLogPayload(payload);
    setLoadingPayload(false);
  };

  const handleCopyPayload = (payload: any) => {
    const payloadString = JSON.stringify(payload, null, 2);
    if (!navigator.clipboard) {
      toast({
        title: 'Failed to copy',
        description:
          'Clipboard API is not available. Please use a secure (HTTPS) connection.',
        variant: 'destructive',
      });
      return;
    }

    navigator.clipboard.writeText(payloadString).then(
      () => {
        toast({
          title: 'Payload copied',
          description: 'The JSON payload has been copied to your clipboard.',
        });
      },
      (err) => {
        console.error('Could not copy text: ', err);
        toast({
          title: 'Failed to copy',
          description:
            'Could not copy to clipboard. Check browser permissions.',
          variant: 'destructive',
        });
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] text-zoru-ink">Webhook event endpoints</h3>
          <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
            {filterByProject
              ? 'Real-time log of events for the selected project.'
              : 'A log of all webhook events received by the system.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-64">
            <ZoruInput
              leadingSlot={<Search />}
              placeholder="Search logs…"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus />
            Create endpoint
          </ZoruButton>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => setTestOpen(true)}
            disabled={isTesting}
          >
            {isTesting ? <Loader2 className="animate-spin" /> : <TestTube />}
            Send test
          </ZoruButton>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            disabled={isClearing || isLoading}
          >
            {isClearing ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Clear processed
          </ZoruButton>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => fetchLogs(currentPage, searchQuery, true)}
            disabled={isLoading}
          >
            <RefreshCw className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </ZoruButton>
        </div>
      </div>

      {isClient && filterByProject && !projectId && !isLoading ? (
        <ZoruAlert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>No project selected</ZoruAlertTitle>
          <ZoruAlertDescription>
            Please select a project from the main dashboard page to view its
            webhook logs.
          </ZoruAlertDescription>
        </ZoruAlert>
      ) : (
        <>
          <div className="overflow-hidden rounded-[var(--zoru-radius-lg)] border border-zoru-line">
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>Timestamp</ZoruTableHead>
                  <ZoruTableHead>Event field</ZoruTableHead>
                  <ZoruTableHead>Details</ZoruTableHead>
                  <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <ZoruTableRow key={i}>
                      <ZoruTableCell colSpan={4}>
                        <ZoruSkeleton className="h-5 w-full" />
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                ) : logs.length > 0 ? (
                  logs.map((log) => (
                    <ZoruTableRow key={log._id.toString()}>
                      <ZoruTableCell>
                        {new Date(log.createdAt).toLocaleString()}
                      </ZoruTableCell>
                      <ZoruTableCell className="font-mono">
                        {log.eventField}
                      </ZoruTableCell>
                      <ZoruTableCell>{log.eventSummary}</ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <ReprocessButton
                            logId={log._id.toString()}
                            onReprocessComplete={() =>
                              fetchLogs(currentPage, searchQuery, false)
                            }
                          />
                          <ZoruButton
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleViewLog(log)}
                            aria-label="View payload"
                          >
                            <Eye />
                          </ZoruButton>
                        </div>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                ) : (
                  <ZoruTableRow>
                    <ZoruTableCell
                      colSpan={4}
                      className="h-24 text-center text-zoru-ink-muted"
                    >
                      No webhook logs found.
                    </ZoruTableCell>
                  </ZoruTableRow>
                )}
              </ZoruTableBody>
            </ZoruTable>
          </div>
          <div className="flex items-center justify-end gap-2 py-2">
            <span className="text-[12px] text-zoru-ink-muted">
              Page {currentPage} of {totalPages > 0 ? totalPages : 1}
            </span>
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={currentPage <= 1 || isLoading}
            >
              Previous
            </ZoruButton>
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage >= totalPages || isLoading}
            >
              Next
            </ZoruButton>
          </div>
        </>
      )}

      {/* View-payload dialog */}
      <ZoruDialog
        open={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      >
        <ZoruDialogContent className="max-w-3xl">
          <ZoruDialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <ZoruDialogTitle>Webhook payload</ZoruDialogTitle>
                <ZoruDialogDescription>
                  Full JSON payload received from Meta at{' '}
                  {selectedLog
                    ? new Date(selectedLog.createdAt).toLocaleString()
                    : ''}
                </ZoruDialogDescription>
              </div>
              {selectedLogPayload && (
                <ZoruButton
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopyPayload(selectedLogPayload)}
                  aria-label="Copy payload"
                >
                  <Copy />
                </ZoruButton>
              )}
            </div>
          </ZoruDialogHeader>
          <div className="mt-2 max-h-[60vh] overflow-y-auto text-[13px]">
            {loadingPayload ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-zoru-ink-muted" />
              </div>
            ) : selectedLogPayload ? (
              <pre className="whitespace-pre-wrap rounded-[var(--zoru-radius)] bg-zoru-surface p-4 font-mono text-[11.5px] text-zoru-ink">
                {JSON.stringify(selectedLogPayload, null, 2)}
              </pre>
            ) : (
              <div className="p-8 text-center text-zoru-ink-muted">
                Could not load payload.
              </div>
            )}
          </div>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* Create-webhook dialog (informational stub; subscription is
          configured per-project in the Setup wizard) */}
      <ZoruDialog open={createOpen} onOpenChange={setCreateOpen}>
        <ZoruDialogContent className="max-w-lg">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Create webhook endpoint</ZoruDialogTitle>
            <ZoruDialogDescription>
              Webhook endpoints are configured automatically when you connect
              a Facebook Page. Use the values below in your Meta App
              configuration if you ever need to recreate them.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          {/* TODO: wire to a dedicated facebook.actions endpoint that
              creates an additional webhook subscription with custom
              callback / verify-token values once that backend exists. */}
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <ZoruLabel>Callback URL</ZoruLabel>
              <ZoruInput
                readOnly
                value={
                  isClient
                    ? `${window.location.origin}/api/webhooks/meta`
                    : '/api/webhooks/meta'
                }
                className="font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <ZoruLabel>Subscribed fields</ZoruLabel>
              <ZoruInput
                readOnly
                value="messages, messaging_postbacks, feed, mentions"
                className="font-mono"
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="outline" onClick={() => setCreateOpen(false)}>
              Close
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* Test-webhook dialog */}
      <ZoruDialog open={testOpen} onOpenChange={setTestOpen}>
        <ZoruDialogContent className="max-w-md">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Send test event</ZoruDialogTitle>
            <ZoruDialogDescription>
              Re-processes the most recent webhook log entry. This is useful
              for verifying that flows and auto-replies still trigger
              correctly.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <ZoruButton variant="outline" onClick={() => setTestOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton onClick={handleTestWebhook} disabled={isTesting}>
              {isTesting ? <Loader2 className="animate-spin" /> : <TestTube />}
              Send test
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* Delete-webhook (clear processed logs) destructive alert */}
      <ZoruAlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Clear processed logs?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes every successfully-processed webhook
              log from the system. Pending and failed events are kept.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              destructive
              onClick={(e) => {
                e.preventDefault();
                handleClearLogs();
              }}
              disabled={isClearing}
            >
              {isClearing ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Clear logs
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
