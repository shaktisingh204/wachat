'use client';

import { useState, useMemo } from 'react';
import type { ClientContract } from '@/lib/client-portal/types';
import { Badge } from '@/components/sabcrm/20ui/compat';
import { Button } from '@/components/sabcrm/20ui/compat';
import { Card, CardBody } from '@/components/sabcrm/20ui/compat';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import { EmptyState } from '@/components/sabcrm/20ui/compat';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/sabcrm/20ui/compat';
import { ChevronDown, Download, History, FileText, ArrowUpDown, MoreHorizontal } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/sabcrm/20ui/compat';
import { Input } from '@/components/sabcrm/20ui/compat';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

function fmtDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString();
    } catch {
        return '—';
    }
}

function fmtCurrency(n: number | undefined, ccy: string | undefined): string {
    if (typeof n !== 'number') return '—';
    const safeCurrency = ccy && ccy.length === 3 ? ccy : 'USD';
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: safeCurrency }).format(n);
    } catch {
        return `${safeCurrency} ${n.toFixed(2)}`;
    }
}

export function ClientContractsClient({ contracts }: { contracts: ClientContract[] }) {
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<'title' | 'startDate' | 'value'>('startDate');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const [selectedContract, setSelectedContract] = useState<ClientContract | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [amendmentsOpen, setAmendmentsOpen] = useState(false);

    const filteredAndSorted = useMemo(() => {
        let list = [...contracts];
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(c => c.title.toLowerCase().includes(q) || c.type?.toLowerCase().includes(q));
        }
        list.sort((a, b) => {
            let res = 0;
            if (sortField === 'title') {
                res = a.title.localeCompare(b.title);
            } else if (sortField === 'startDate') {
                const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
                const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
                res = dateA - dateB;
            } else if (sortField === 'value') {
                const valA = a.value || 0;
                const valB = b.value || 0;
                res = valA - valB;
            }
            return sortOrder === 'asc' ? res : -res;
        });
        return list;
    }, [contracts, search, sortField, sortOrder]);

    const handleSort = (field: 'title' | 'startDate' | 'value') => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };

    const openHistory = (contract: ClientContract) => {
        setSelectedContract(contract);
        setHistoryOpen(true);
    };

    const openAmendments = (contract: ClientContract) => {
        setSelectedContract(contract);
        setAmendmentsOpen(true);
    };

    if (contracts.length === 0) {
        return (
            <EmptyState
                title="No contracts yet"
                description="Contracts shared with you will appear here."
            />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Input 
                    placeholder="Search contracts..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    className="max-w-sm"
                />
            </div>

            <Card>
                <CardBody className="p-0 overflow-x-auto">
                    <Table>
                        <THead>
                            <Tr>
                                <Th onClick={() => handleSort('title')} className="cursor-pointer">
                                    <div className="flex items-center gap-1 hover:text-[var(--st-text)]">Name <ArrowUpDown className="h-3 w-3" /></div>
                                </Th>
                                <Th>Type</Th>
                                <Th onClick={() => handleSort('value')} className="cursor-pointer">
                                    <div className="flex items-center gap-1 hover:text-[var(--st-text)]">Amount <ArrowUpDown className="h-3 w-3" /></div>
                                </Th>
                                <Th onClick={() => handleSort('startDate')} className="cursor-pointer">
                                    <div className="flex items-center gap-1 hover:text-[var(--st-text)]">Period <ArrowUpDown className="h-3 w-3" /></div>
                                </Th>
                                <Th>Status</Th>
                                <Th className="text-right">Actions</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {filteredAndSorted.map((c) => {
                                const unsigned = !c.signedAt;
                                return (
                                    <Tr key={c._id}>
                                        <Td className="font-medium text-[var(--st-text)]">{c.title}</Td>
                                        <Td>{c.type ?? '—'}</Td>
                                        <Td>{fmtCurrency(c.value, c.currency)}</Td>
                                        <Td className="text-xs text-[var(--st-text-secondary)]">
                                            {fmtDate(c.startDate)} – {fmtDate(c.endDate)}
                                        </Td>
                                        <Td>
                                            <Badge variant={unsigned ? 'outline' : 'secondary'}>
                                                {c.signedAt ? 'Signed' : c.status}
                                            </Badge>
                                        </Td>
                                        <Td className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {unsigned && c.publicHash && (
                                                    <Button asChild size="sm">
                                                        <a href={`/share/contract/${c.publicHash}`}>Sign</a>
                                                    </Button>
                                                )}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {c.publicHash && (
                                                            <DropdownMenuItem asChild>
                                                                <a href={`/share/contract/${c.publicHash}/download`} target="_blank" rel="noopener noreferrer">
                                                                    <Download className="mr-2 h-4 w-4" /> Download PDF
                                                                </a>
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem onClick={() => openHistory(c)}>
                                                            <History className="mr-2 h-4 w-4" /> Signature History
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => openAmendments(c)}>
                                                            <FileText className="mr-2 h-4 w-4" /> Amendments
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </Td>
                                    </Tr>
                                );
                            })}
                            {filteredAndSorted.length === 0 && (
                                <Tr>
                                    <Td colSpan={6} className="h-24 text-center">
                                        No matching contracts.
                                    </Td>
                                </Tr>
                            )}
                        </TBody>
                    </Table>
                </CardBody>
            </Card>

            <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Signature History</DialogTitle>
                        <DialogDescription>{selectedContract?.title}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {!selectedContract?.signatures?.length ? (
                            <p className="text-sm text-[var(--st-text-secondary)]">No signatures recorded yet.</p>
                        ) : (
                            <div className="space-y-4">
                                {selectedContract.signatures.map((sig, i) => (
                                    <div key={i} className="flex flex-col gap-1 text-sm border-b pb-3 last:border-0 last:pb-0">
                                        <p className="font-medium text-[var(--st-text)]">{sig.fullName} {sig.party ? `(${sig.party})` : ''}</p>
                                        <p className="text-xs text-[var(--st-text-secondary)]">Signed at: {fmtDate(sig.signedAt)}</p>
                                        {sig.place && <p className="text-xs text-[var(--st-text-secondary)]">Place: {sig.place}</p>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={amendmentsOpen} onOpenChange={setAmendmentsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Versions & Amendments</DialogTitle>
                        <DialogDescription>{selectedContract?.title}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {!selectedContract?.amendments?.length ? (
                            <p className="text-sm text-[var(--st-text-secondary)]">No amendments for this contract.</p>
                        ) : (
                            <div className="space-y-4">
                                {selectedContract.amendments.map((a, i) => (
                                    <div key={i} className="flex flex-col gap-1 text-sm border-b pb-3 last:border-0 last:pb-0">
                                        <div className="flex justify-between items-center">
                                            <p className="font-medium text-[var(--st-text)]">{a.title}</p>
                                            <Badge variant="outline">{a.status}</Badge>
                                        </div>
                                        <p className="text-xs text-[var(--st-text-secondary)]">Created: {fmtDate(a.createdAt)}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
