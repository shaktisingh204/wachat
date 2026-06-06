'use client';

import { useState } from 'react';
import { Badge } from '@/components/sabcrm/20ui';
import { Button } from '@/components/sabcrm/20ui';
import { Td, Tr } from '@/components/sabcrm/20ui';
import { getEstimateItems, requestEstimateRevision, type EstimateItem } from './actions';
import { Loader2, MessageSquare, ChevronDown, ChevronRight, Check } from 'lucide-react';
import type { ClientEstimate } from '@/lib/client-portal/types';

function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString();
}

function fmtCurrency(n: number, ccy: string): string {
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: ccy || 'USD' }).format(n);
    } catch {
        return String(n);
    }
}

function getStatusColor(status: string) {
    const s = status.toLowerCase();
    if (s === 'waiting' || s === 'sent') return 'bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]';
    if (s === 'accepted') return 'bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]';
    if (s === 'declined') return 'bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]';
    if (s === 'revision-requested') return 'bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]';
    return 'bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]';
}

export function EstimateRow({ est }: { est: ClientEstimate }) {
    const [expanded, setExpanded] = useState(false);
    const [items, setItems] = useState<EstimateItem[] | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Revision state
    const [itemComments, setItemComments] = useState<Record<string, string>>({});
    const [generalComment, setGeneralComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const waiting = ['waiting', 'sent', 'Sent'].includes(est.status);

    async function toggleExpand() {
        if (!expanded && items === null) {
            setLoading(true);
            try {
                const res = await getEstimateItems(est._id);
                setItems(res);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        setExpanded(!expanded);
    }

    async function handleRequestRevision() {
        if (submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            await requestEstimateRevision(est._id, generalComment, itemComments);
            setSubmitted(true);
            setExpanded(false);
        } catch (err: any) {
            setError(err.message || 'Failed to request revision');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <>
            <Tr className="cursor-pointer hover:bg-[var(--st-bg-muted)]" onClick={toggleExpand}>
                <Td className="w-10">
                    {expanded ? <ChevronDown className="h-4 w-4 text-[var(--st-text-secondary)]" /> : <ChevronRight className="h-4 w-4 text-[var(--st-text-secondary)]" />}
                </Td>
                <Td className="font-medium text-[var(--st-text)]">{est.number}</Td>
                <Td>{fmtDate(est.validTill)}</Td>
                <Td>{fmtCurrency(est.total, est.currency)}</Td>
                <Td>
                    <Badge variant="outline" className={getStatusColor(est.status)}>{est.status}</Badge>
                </Td>
                <Td className="text-right" onClick={e => e.stopPropagation()}>
                    {waiting && est.publicHash ? (
                        <div className="flex justify-end gap-2">
                            <Button asChild size="sm">
                                <a href={`/share/estimate/${est.publicHash}`}>Review & Accept</a>
                            </Button>
                        </div>
                    ) : (
                        <span className="text-xs text-[var(--st-text-secondary)]">—</span>
                    )}
                </Td>
            </Tr>
            {expanded && (
                <Tr>
                    <Td colSpan={6} className="bg-[var(--st-bg-muted)] p-0 border-b">
                        <div className="p-6">
                            <h3 className="font-semibold text-lg mb-4">Line Items</h3>
                            {loading ? (
                                <div className="flex items-center gap-2 text-sm text-[var(--st-text)]">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading items...
                                </div>
                            ) : items && items.length > 0 ? (
                                <div className="space-y-6">
                                    <div className="border rounded-md overflow-hidden bg-white">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-[var(--st-bg-muted)] text-[var(--st-text)] font-medium">
                                                <tr>
                                                    <th className="px-4 py-2 border-b">Description</th>
                                                    <th className="px-4 py-2 border-b text-right">Qty</th>
                                                    <th className="px-4 py-2 border-b text-right">Rate</th>
                                                    <th className="px-4 py-2 border-b text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.map((item, i) => {
                                                    const itemId = item._id || String(i);
                                                    return (
                                                        <tr key={itemId} className="border-b last:border-0 group">
                                                            <td className="px-4 py-3 align-top">
                                                                <div>{item.description}</div>
                                                                {waiting && (
                                                                    <div className="mt-2 text-xs">
                                                                        <div className="flex items-center gap-1 text-[var(--st-text)] mb-1">
                                                                            <MessageSquare className="h-3 w-3" /> Comment on this item
                                                                        </div>
                                                                        <textarea
                                                                            value={itemComments[itemId] || ''}
                                                                            onChange={e => setItemComments(prev => ({ ...prev, [itemId]: e.target.value }))}
                                                                            placeholder="Any issues with this line item?"
                                                                            className="w-full border rounded p-2 text-sm"
                                                                            rows={2}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 align-top text-right">{item.quantity}</td>
                                                            <td className="px-4 py-3 align-top text-right">{fmtCurrency(item.rate, est.currency)}</td>
                                                            <td className="px-4 py-3 align-top text-right font-medium">{fmtCurrency(item.total, est.currency)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    {waiting && (
                                        <div className="bg-white p-4 border rounded-md">
                                            <h4 className="font-medium mb-2">Request Revision</h4>
                                            <p className="text-sm text-[var(--st-text)] mb-3">
                                                If you need changes to this estimate before accepting, leave your comments above and provide a general note below.
                                            </p>
                                            <textarea
                                                value={generalComment}
                                                onChange={e => setGeneralComment(e.target.value)}
                                                placeholder="General revision request notes..."
                                                className="w-full border rounded p-2 text-sm mb-3"
                                                rows={3}
                                            />
                                            {error && <div className="text-[var(--st-text)] text-sm mb-3">{error}</div>}
                                            <Button 
                                                onClick={handleRequestRevision} 
                                                disabled={submitting || (generalComment.trim() === '' && Object.keys(itemComments).filter(k => itemComments[k].trim() !== '').length === 0)}
                                            >
                                                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : 'Submit Revision Request'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm text-[var(--st-text)] italic">No line items found.</div>
                            )}
                        </div>
                    </Td>
                </Tr>
            )}
        </>
    );
}
