'use client';

import { useState } from 'react';
import {
    Badge,
    Button,
    Td,
    Tr,
    Table,
    THead,
    TBody,
    Th,
    Field,
    Textarea,
    Card,
    Alert,
    EmptyState,
    Spinner,
    type BadgeTone,
} from '@/components/sabcrm/20ui';
import { getEstimateItems, requestEstimateRevision, type EstimateItem } from './actions';
import { MessageSquare, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import type { ClientEstimate } from '@/lib/client-portal/types';

function fmtDate(iso: string | null): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString();
}

function fmtCurrency(n: number, ccy: string): string {
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: ccy || 'USD' }).format(n);
    } catch {
        return String(n);
    }
}

function getStatusTone(status: string): BadgeTone {
    const s = status.toLowerCase();
    if (s === 'accepted') return 'success';
    if (s === 'declined') return 'danger';
    if (s === 'revision-requested') return 'warning';
    if (s === 'waiting' || s === 'sent') return 'info';
    return 'neutral';
}

export function EstimateRow({ est }: { est: ClientEstimate }) {
    const [expanded, setExpanded] = useState(false);
    const [items, setItems] = useState<EstimateItem[] | null>(null);
    const [loading, setLoading] = useState(false);

    // Revision state
    const [itemComments, setItemComments] = useState<Record<string, string>>({});
    const [generalComment, setGeneralComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [, setSubmitted] = useState(false);
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

    const revisionDisabled =
        submitting ||
        (generalComment.trim() === '' &&
            Object.keys(itemComments).filter((k) => itemComments[k].trim() !== '').length === 0);

    return (
        <>
            <Tr className="cursor-pointer" onClick={toggleExpand}>
                <Td className="w-10">
                    {expanded ? (
                        <ChevronDown className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                    ) : (
                        <ChevronRight className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                    )}
                </Td>
                <Td className="font-medium text-[var(--st-text)]">{est.number}</Td>
                <Td>{fmtDate(est.validTill)}</Td>
                <Td>{fmtCurrency(est.total, est.currency)}</Td>
                <Td>
                    <Badge tone={getStatusTone(est.status)}>{est.status}</Badge>
                </Td>
                <Td align="right" onClick={(e) => e.stopPropagation()}>
                    {waiting && est.publicHash ? (
                        <div className="flex justify-end gap-2">
                            <Button
                                size="sm"
                                variant="primary"
                                onClick={() => {
                                    window.location.href = `/share/estimate/${est.publicHash}`;
                                }}
                            >
                                Review &amp; Accept
                            </Button>
                        </div>
                    ) : (
                        <span className="text-xs text-[var(--st-text-secondary)]">-</span>
                    )}
                </Td>
            </Tr>
            {expanded && (
                <Tr>
                    <Td colSpan={6} className="bg-[var(--st-bg-secondary)] p-0">
                        <div className="p-6">
                            <h3 className="font-semibold text-lg mb-4 text-[var(--st-text)]">Line Items</h3>
                            {loading ? (
                                <div className="flex items-center gap-2 text-sm text-[var(--st-text)]">
                                    <Spinner size="sm" label="Loading items" /> Loading items...
                                </div>
                            ) : items && items.length > 0 ? (
                                <div className="space-y-6">
                                    <Card variant="outlined" padding="none" className="overflow-hidden">
                                        <Table>
                                            <THead>
                                                <Tr>
                                                    <Th>Description</Th>
                                                    <Th align="right">Qty</Th>
                                                    <Th align="right">Rate</Th>
                                                    <Th align="right">Total</Th>
                                                </Tr>
                                            </THead>
                                            <TBody>
                                                {items.map((item, i) => {
                                                    const itemId = item._id || String(i);
                                                    return (
                                                        <Tr key={itemId}>
                                                            <Td className="align-top">
                                                                <div>{item.description}</div>
                                                                {waiting && (
                                                                    <div className="mt-2">
                                                                        <Field
                                                                            label={
                                                                                <span className="flex items-center gap-1 text-[var(--st-text-secondary)]">
                                                                                    <MessageSquare
                                                                                        className="h-3 w-3"
                                                                                        aria-hidden="true"
                                                                                    />
                                                                                    Comment on this item
                                                                                </span>
                                                                            }
                                                                        >
                                                                            <Textarea
                                                                                value={itemComments[itemId] || ''}
                                                                                onChange={(e) =>
                                                                                    setItemComments((prev) => ({
                                                                                        ...prev,
                                                                                        [itemId]: e.target.value,
                                                                                    }))
                                                                                }
                                                                                placeholder="Any issues with this line item?"
                                                                                rows={2}
                                                                            />
                                                                        </Field>
                                                                    </div>
                                                                )}
                                                            </Td>
                                                            <Td align="right" className="align-top">
                                                                {item.quantity}
                                                            </Td>
                                                            <Td align="right" className="align-top">
                                                                {fmtCurrency(item.rate, est.currency)}
                                                            </Td>
                                                            <Td align="right" className="align-top font-medium">
                                                                {fmtCurrency(item.total, est.currency)}
                                                            </Td>
                                                        </Tr>
                                                    );
                                                })}
                                            </TBody>
                                        </Table>
                                    </Card>

                                    {waiting && (
                                        <Card variant="outlined" padding="md">
                                            <h4 className="font-medium mb-2 text-[var(--st-text)]">Request Revision</h4>
                                            <p className="text-sm text-[var(--st-text-secondary)] mb-3">
                                                If you need changes to this estimate before accepting, leave your
                                                comments above and provide a general note below.
                                            </p>
                                            <Field className="mb-3">
                                                <Textarea
                                                    value={generalComment}
                                                    onChange={(e) => setGeneralComment(e.target.value)}
                                                    placeholder="General revision request notes..."
                                                    rows={3}
                                                />
                                            </Field>
                                            {error && (
                                                <Alert tone="danger" className="mb-3">
                                                    {error}
                                                </Alert>
                                            )}
                                            <Button
                                                variant="primary"
                                                onClick={handleRequestRevision}
                                                loading={submitting}
                                                disabled={revisionDisabled}
                                            >
                                                {submitting ? 'Submitting...' : 'Submit Revision Request'}
                                            </Button>
                                        </Card>
                                    )}
                                </div>
                            ) : (
                                <EmptyState
                                    icon={FileText}
                                    title="No line items found"
                                    description="This estimate has no line items yet."
                                    size="sm"
                                />
                            )}
                        </div>
                    </Td>
                </Tr>
            )}
        </>
    );
}
