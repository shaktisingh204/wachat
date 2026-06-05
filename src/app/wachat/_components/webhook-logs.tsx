'use client';
import { fmtDate } from "@/lib/utils";

import {
  Alert,
  Button,
  IconButton,
  Modal,
  Input,
  Skeleton,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import {
  AlertCircle,
  Copy,
  Eye,
  Loader2,
  RefreshCw,
  RotateCw,
  Search,
  Trash2,
  } from 'lucide-react';

import {
  getWebhookLogPayload,
  getWebhookLogs,
  handleClearProcessedLogs,
  } from '@/app/actions/index.ts';
import { handleReprocessWebhook } from '@/app/actions/webhook.actions';
import type { WebhookLogListItem } from '@/lib/definitions';

/**
 * WebhookLogs (wachat-local, 20ui).
 *
 * Replaces the legacy webhook-logs. Same server actions
 * (getWebhookLogs, handleClearProcessedLogs, handleReprocessWebhook,
 * getWebhookLogPayload), same pagination + reprocess + payload-view
 * behaviour.
 */

import * as React from 'react';

const LOGS_PER_PAGE = 15;

function ReprocessButton({
  logId,
  onReprocessComplete,
}: {
  logId: string;
  onReprocessComplete: () => void;
}) {
  const [isProcessing, startTransition] = useTransition();
  const { toast } = useToast();

  const onReprocess = () => {
    startTransition(async () => {
      const result = await handleReprocessWebhook(logId);
      if (result.error) {
        toast({
          title: 'Error Re-processing',
          description: result.error,
          tone: 'danger',
        });
      } else {
        toast({ title: 'Success', description: result.message });
        onReprocessComplete();
      }
    });
  };

  if (isProcessing) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        aria-label="Re-processing webhook"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </Button>
    );
  }

  return (
    <IconButton
      label="Re-process Webhook"
      icon={RotateCw}
      variant="ghost"
      size="sm"
      onClick={onReprocess}
    />
  );
}

interface WebhookLogsProps {
  filterByProject?: boolean;
}

export function WebhookLogs({ filterByProject = false }: WebhookLogsProps) {
  const [logs, setLogs] = useState<WebhookLogListItem[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const [isClearing, startClearingTransition] = useTransition();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const [selectedLog, setSelectedLog] = useState<WebhookLogListItem | null>(
    null,
  );
  const [selectedLogPayload, setSelectedLogPayload] = useState<any | null>(
    null,
  );
  const [loadingPayload, setLoadingPayload] = useState(false);

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
            tone: 'danger',
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
  }, [currentPage, searchQuery, fetchLogs, isClient, projectId, filterByProject]);

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
          tone: 'danger',
        });
      } else {
        toast({ title: 'Success', description: result.message });
        fetchLogs(1, searchQuery, false);
        setCurrentPage(1);
      }
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
        tone: 'danger',
      });
      return;
    }

    navigator.clipboard.writeText(payloadString).then(
      () => {
        toast({
          title: 'Payload Copied!',
          description: 'The JSON payload has been copied to your clipboard.',
        });
      },
      (err) => {
        console.error('Could not copy text: ', err);
        toast({
          title: 'Failed to copy',
          description:
            'Could not copy to clipboard. Check browser permissions.',
          tone: 'danger',
        });
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px]" style={{ color: 'var(--st-text)' }}>
            Webhook Event Logs
          </h3>
          <p
            className="mt-0.5 text-[12px]"
            style={{ color: 'var(--st-text-muted)' }}
          >
            {filterByProject
              ? 'Real-time log of events for the selected project.'
              : 'A log of all webhook events received by the system.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-64">
            <Input
              iconLeft={Search}
              placeholder="Search logs…"
              aria-label="Search logs"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <Button
            onClick={handleClearLogs}
            disabled={isClearing || isLoading}
            variant="outline"
            size="sm"
          >
            {isClearing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Clear Processed Logs
          </Button>
          <Button
            onClick={() => fetchLogs(currentPage, searchQuery, true)}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {isClient && filterByProject && !projectId && !isLoading ? (
        <Alert tone="danger" icon={AlertCircle} title="No Project Selected">
          Please select a project from the main dashboard page to view its
          webhook logs.
        </Alert>
      ) : (
        <>
          <div
            className="overflow-hidden"
            style={{
              borderRadius: 'var(--st-radius-lg)',
              border: '1px solid var(--st-border)',
            }}
          >
            <Table>
              <THead>
                <Tr>
                  <Th>Timestamp</Th>
                  <Th>Event Field</Th>
                  <Th>Details</Th>
                  <Th align="right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Tr key={i}>
                      <Td colSpan={4}>
                        <Skeleton height={20} />
                      </Td>
                    </Tr>
                  ))
                ) : logs.length > 0 ? (
                  logs.map((log) => (
                    <Tr key={log._id.toString()}>
                      <Td>{fmtDate(log.createdAt)}</Td>
                      <Td className="font-mono">{log.eventField}</Td>
                      <Td>{log.eventSummary}</Td>
                      <Td align="right">
                        <div className="flex items-center justify-end gap-1">
                          <ReprocessButton
                            logId={log._id.toString()}
                            onReprocessComplete={() =>
                              fetchLogs(currentPage, searchQuery, false)
                            }
                          />
                          <IconButton
                            label="View Payload"
                            icon={Eye}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewLog(log)}
                          />
                        </div>
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td
                      colSpan={4}
                      align="center"
                      className="h-24"
                      style={{ color: 'var(--st-text-muted)' }}
                    >
                      No webhook logs found.
                    </Td>
                  </Tr>
                )}
              </TBody>
            </Table>
          </div>
          <div className="flex items-center justify-end gap-2 py-2">
            <span
              className="text-[12px]"
              style={{ color: 'var(--st-text-muted)' }}
            >
              Page {currentPage} of {totalPages > 0 ? totalPages : 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={currentPage <= 1 || isLoading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage >= totalPages || isLoading}
            >
              Next
            </Button>
          </div>
        </>
      )}

      <Modal
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        size="lg"
        title="Webhook Payload"
        description={`Full JSON payload received from Meta at ${
          selectedLog ? fmtDate(selectedLog.createdAt) : ''
        }`}
        footer={
          selectedLogPayload ? (
            <Button
              variant="outline"
              iconLeft={Copy}
              onClick={() => handleCopyPayload(selectedLogPayload)}
            >
              Copy Payload
            </Button>
          ) : undefined
        }
      >
        <div className="max-h-[60vh] overflow-y-auto text-[13px]">
          {loadingPayload ? (
            <div className="flex items-center justify-center p-8">
              <Loader2
                className="h-6 w-6 animate-spin"
                style={{ color: 'var(--st-text-muted)' }}
              />
            </div>
          ) : selectedLogPayload ? (
            <pre
              className="whitespace-pre-wrap p-4 font-mono text-[11.5px]"
              style={{
                borderRadius: 'var(--st-radius)',
                background: 'var(--st-bg-secondary)',
                color: 'var(--st-text)',
              }}
            >
              {JSON.stringify(selectedLogPayload, null, 2)}
            </pre>
          ) : (
            <div
              className="p-8 text-center"
              style={{ color: 'var(--st-text-muted)' }}
            >
              Could not load payload.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
