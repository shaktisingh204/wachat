'use client';

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  Field,
  Input,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  EmptyState,
  Modal,
  ScrollArea,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { getFlowLogsForAdmin, getFlowLogPayloadForAdmin, replayFlowLog } from '@/app/actions/admin-hardening.actions';
import type { FlowLog, FlowLogEntry } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import { useDebouncedCallback } from 'use-debounce';
import { Eye, Search, LoaderCircle, GitFork, Copy, RefreshCw } from 'lucide-react';

const LOGS_PER_PAGE = 20;

export default function FlowLogsPage() {
    const [logs, setLogs] = useState<Omit<WithId<FlowLog>, 'entries'>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLog, setSelectedLog] = useState<WithId<FlowLog> | null>(null);
    const [loadingPayload, setLoadingPayload] = useState(false);
    const { toast } = useToast();

    const fetchLogs = useCallback((page: number, query: string) => {
        startTransition(async () => {
            try {
                const { logs: newLogs, total } = await getFlowLogsForAdmin(page, LOGS_PER_PAGE, query);
                setLogs(newLogs);
                setTotalPages(Math.ceil(total / LOGS_PER_PAGE));
            } catch {
                toast({ title: 'Error', description: 'Failed to fetch flow logs.', tone: 'danger' });
            }
        });
    }, [toast]);

    useEffect(() => { fetchLogs(currentPage, searchQuery); }, [currentPage, searchQuery, fetchLogs]);

    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
        setCurrentPage(1);
    }, 500);

    const handleViewLog = async (log: Omit<WithId<FlowLog>, 'entries'>) => {
        setSelectedLog(null);
        setLoadingPayload(true);
        const full = await getFlowLogPayloadForAdmin(log._id.toString());
        setSelectedLog(full);
        setLoadingPayload(false);
    };

    const handleCopy = (data: FlowLogEntry[]) => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() =>
            toast({ title: 'Copied', description: 'Log data copied to clipboard.', tone: 'success' })
        );
    };

    const handleRetry = async (logId: string) => {
        try {
            const res = await replayFlowLog(logId);
            if (res.success) {
                toast({ title: 'Success', description: 'Flow queued for replay.', tone: 'success' });
                fetchLogs(currentPage, searchQuery);
            } else {
                toast({ title: 'Error', description: res.error || 'Failed to replay flow.', tone: 'danger' });
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to replay flow.', tone: 'danger' });
        }
    };

    const closeModal = () => { setSelectedLog(null); setLoadingPayload(false); };

    return (
        <>
            <div className="space-y-6">
                <PageHeader>
                    <PageHeaderHeading>
                        <PageTitle>Flow Execution Logs</PageTitle>
                        <PageDescription>Detailed log of every flow run for every contact.</PageDescription>
                    </PageHeaderHeading>
                </PageHeader>

                <Card padding="none">
                    <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <GitFork className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                            <CardTitle>All Executions</CardTitle>
                        </div>
                        <div className="w-72">
                            <Field label="Search executions" help="Filter by flow name or contact ID.">
                                <Input
                                    type="search"
                                    iconLeft={Search}
                                    placeholder="Search by flow name or contact ID"
                                    onChange={(e) => handleSearch(e.target.value)}
                                />
                            </Field>
                        </div>
                    </CardHeader>

                    <CardBody className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <THead>
                                    <Tr>
                                        <Th>Timestamp</Th>
                                        <Th>Flow Name</Th>
                                        <Th>Contact ID</Th>
                                        <Th>Project ID</Th>
                                        <Th align="right">Actions</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {isLoading ? (
                                        [...Array(6)].map((_, i) => (
                                            <Tr key={i}>
                                                <Td colSpan={5}>
                                                    <div className="h-4 rounded bg-[var(--st-bg-secondary)] animate-pulse" />
                                                </Td>
                                            </Tr>
                                        ))
                                    ) : logs.length > 0 ? (
                                        logs.map((log) => (
                                            <Tr key={log._id.toString()}>
                                                <Td className="text-xs text-[var(--st-text-secondary)] whitespace-nowrap">
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </Td>
                                                <Td className="font-medium text-[var(--st-text)]">{log.flowName}</Td>
                                                <Td className="font-mono text-xs text-[var(--st-text-secondary)]">{log.contactId?.toString()}</Td>
                                                <Td className="font-mono text-xs text-[var(--st-text-secondary)]">{log.projectId?.toString()}</Td>
                                                <Td align="right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="outline" size="sm" iconLeft={Eye} onClick={() => handleViewLog(log)}>
                                                            View
                                                        </Button>
                                                        <Button variant="outline" size="sm" iconLeft={RefreshCw} onClick={() => handleRetry(log._id.toString())}>
                                                            Retry
                                                        </Button>
                                                    </div>
                                                </Td>
                                            </Tr>
                                        ))
                                    ) : (
                                        <Tr>
                                            <Td colSpan={5} className="p-0">
                                                <EmptyState
                                                    icon={GitFork}
                                                    title="No flow logs found"
                                                    description="Flow runs will appear here once your automations start executing."
                                                />
                                            </Td>
                                        </Tr>
                                    )}
                                </TBody>
                            </Table>
                        </div>
                    </CardBody>

                    <CardFooter className="flex items-center justify-between">
                        <span className="text-xs text-[var(--st-text-secondary)]">Page {currentPage} of {totalPages > 0 ? totalPages : 1}</span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage <= 1 || isLoading}>
                                Previous
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages || isLoading}>
                                Next
                            </Button>
                        </div>
                    </CardFooter>
                </Card>
            </div>

            <Modal
                open={Boolean(selectedLog || loadingPayload)}
                onClose={closeModal}
                size="lg"
                title="Flow Log Details"
                description={selectedLog ? `${selectedLog.flowName} . ${new Date(selectedLog.createdAt).toLocaleString()}` : undefined}
                footer={selectedLog ? (
                    <Button variant="outline" size="sm" iconLeft={Copy} onClick={() => handleCopy(selectedLog.entries)}>
                        Copy
                    </Button>
                ) : undefined}
            >
                {loadingPayload ? (
                    <div className="flex items-center justify-center py-12">
                        <LoaderCircle className="h-6 w-6 animate-spin text-[var(--st-text-secondary)]" aria-hidden="true" />
                        <span className="sr-only">Loading log payload</span>
                    </div>
                ) : selectedLog ? (
                    <ScrollArea className="max-h-[60vh]">
                        <div className="space-y-2 pr-2">
                            {selectedLog.entries.map((entry, i) => (
                                <div key={i} className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-xs font-mono">
                                    <p>
                                        <span className="text-[var(--st-text)] font-semibold">
                                            [{new Date(entry.timestamp).toLocaleTimeString('en-GB', { hour12: false, fractionalSecondDigits: 3 })}]
                                        </span>
                                        {' '}
                                        <span className="text-[var(--st-text)]">{entry.message}</span>
                                    </p>
                                    {entry.data && (
                                        <details className="mt-1.5">
                                            <summary className="cursor-pointer text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors">View Data</summary>
                                            <pre className="mt-1 p-2 rounded-[var(--st-radius)] bg-[var(--st-bg)] text-[var(--st-text)] text-xs whitespace-pre-wrap max-h-48 overflow-auto">
                                                {JSON.stringify(entry.data, null, 2)}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                ) : null}
            </Modal>
        </>
    );
}
