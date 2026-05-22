import { Badge, Button, Card } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import Link from 'next/link';
import { Activity,
  Pencil,
  Plus,
  Trash2,
  Trophy } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

/**
 * Award detail — §1D.2 bar.
 *
 * Shows the program meta + a nomination table (appreciations linked to
 * this award). Voting / winner-select are deferred (TODO 1D.2 — needs
 * a `vote_count` and `winner_id` extension on appreciations).
 */

import {
    getAppreciations,
    getAwardById,
} from '@/app/actions/worksuite/knowledge.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

export const dynamic = 'force-dynamic';

function fmtDate(v: unknown) {
    if (!v) return '—';
    const d = new Date(v as string);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString() : '—';
}

export default async function AwardDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const [award, apps] = await Promise.all([
        getAwardById(id),
        getAppreciations(),
    ]);
    if (!award) notFound();

    const a = award as any;
    const linked = (apps as any[]).filter((x) => x.award_id === a._id);

    return (
        <div className="p-4 md:p-6">
            <EntityDetailShell
                title={`${a.icon || '🏆'} ${a.title}`}
                eyebrow="AWARD"
                status={{ label: 'Active', tone: 'green' }}
                back={{ href: '/dashboard/crm/workspace/awards', label: 'Back to awards' }}
                actions={
                    <>
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/dashboard/crm/workspace/awards/${a._id}/edit`}>
                                <Pencil className="h-3.5 w-3.5" /> Edit
                            </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <Link
                                href={`/dashboard/crm/workspace/awards/appreciations?award=${a._id}`}
                            >
                                <Plus className="h-3.5 w-3.5" /> Add appreciation
                            </Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                            <Link href={`/dashboard/crm/workspace/awards/${a._id}/activity`}>
                                <Activity className="h-3.5 w-3.5" /> Activity
                            </Link>
                        </Button>
                    </>
                }
                audit={<EntityAuditTimeline entityKind="award" entityId={String(a._id)} />}
                rightRail={
                    <Card>
                        <h3 className="mb-2 text-[13.5px] font-semibold text-zoru-ink">
                            Program details
                        </h3>
                        <dl className="grid grid-cols-2 gap-y-1 text-[12.5px]">
                            <dt className="text-zoru-ink-muted">Frequency</dt>
                            <dd className="text-zoru-ink capitalize">{a.frequency}</dd>
                            <dt className="text-zoru-ink-muted">Nominations</dt>
                            <dd className="text-zoru-ink">{linked.length}</dd>
                            <dt className="text-zoru-ink-muted">Winners</dt>
                            <dd className="text-zoru-ink">
                                {new Set(linked.map((x: any) => x.given_to_user_id)).size}
                            </dd>
                            <dt className="text-zoru-ink-muted">Prize</dt>
                            <dd className="text-zoru-ink">{a.prize || '—'}</dd>
                        </dl>
                    </Card>
                }
            >
                <Card>
                    <h3 className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-zoru-ink">
                        <Trophy className="h-4 w-4" /> About this program
                    </h3>
                    {a.summary ? (
                        <p className="text-[13.5px] text-zoru-ink">{a.summary}</p>
                    ) : (
                        <p className="text-[13px] text-zoru-ink-muted">No summary.</p>
                    )}
                    {a.criteria ? (
                        <div className="mt-3">
                            <h4 className="text-[12.5px] font-semibold text-zoru-ink-muted">
                                Criteria
                            </h4>
                            <p className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">
                                {a.criteria}
                            </p>
                        </div>
                    ) : null}
                </Card>

                <Card>
                    <h3 className="mb-3 text-[14px] font-semibold text-zoru-ink">
                        Nominations & winners ({linked.length})
                    </h3>
                    {linked.length === 0 ? (
                        <p className="text-[13px] text-zoru-ink-muted">
                            No nominations yet. Grant the first appreciation against this
                            program from the Appreciations sub-route.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[500px] text-[12.5px]">
                                <thead className="text-zoru-ink-muted">
                                    <tr>
                                        {['Given to', 'Given by', 'Given on', 'Summary'].map((h) => (
                                            <th key={h} className="px-2 py-1 text-left font-medium">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zoru-line">
                                    {linked.map((ap: any) => (
                                        <tr key={String(ap._id)}>
                                            <td className="px-2 py-1.5">
                                                <Badge variant="success">
                                                    {ap.given_to_user_name || ap.given_to_user_id}
                                                </Badge>
                                            </td>
                                            <td className="px-2 py-1.5 text-zoru-ink-muted">
                                                {ap.given_by_user_name || ap.given_by_user_id}
                                            </td>
                                            <td className="px-2 py-1.5 text-zoru-ink-muted">
                                                {fmtDate(ap.given_on)}
                                            </td>
                                            <td className="px-2 py-1.5 text-zoru-ink-muted line-clamp-1">
                                                {ap.summary || '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </EntityDetailShell>
        </div>
    );
}
