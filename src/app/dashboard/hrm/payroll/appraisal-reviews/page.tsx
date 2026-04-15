export const dynamic = 'force-dynamic';

import { getCrmAppraisalReviews } from '@/app/actions/crm-hr-appraisals.actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star } from 'lucide-react';
import { format } from 'date-fns';

import { ClayCard, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

export default async function AppraisalReviewsPage() {
    const reviews = await getCrmAppraisalReviews();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Appraisal Reviews"
                subtitle="Performance evaluations and feedback."
                icon={Star}
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Performance Reviews</h2>
                    <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">History of employee appraisals.</p>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Review Date</TableHead>
                                <TableHead className="text-clay-ink-muted">Employee</TableHead>
                                <TableHead className="text-clay-ink-muted">Reviewer</TableHead>
                                <TableHead className="text-clay-ink-muted">Status</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Overall Rating</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reviews.length === 0 ? (
                                <TableRow className="border-clay-border">
                                    <TableCell colSpan={5} className="h-24 text-center text-[13px] text-clay-ink-muted">
                                        No appraisals found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                reviews.map((review: any) => {
                                    const ratings = Object.values(review.ratings || {}).filter(v => typeof v === 'number') as number[];
                                    const average = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;

                                    return (
                                        <TableRow key={review._id.toString()} className="border-clay-border">
                                            <TableCell className="text-[13px] text-clay-ink">{format(new Date(review.reviewDate), 'PP')}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-clay-ink">
                                                {review.employeeInfo?.firstName} {review.employeeInfo?.lastName}
                                            </TableCell>
                                            <TableCell className="text-[13px] text-clay-ink">
                                                {review.reviewerInfo?.name || 'Unknown'}
                                            </TableCell>
                                            <TableCell>
                                                <ClayBadge tone={review.status === 'Completed' ? 'green' : 'amber'}>
                                                    {review.status}
                                                </ClayBadge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <span className="text-[13px] font-bold text-clay-ink">{average.toFixed(1)}</span>
                                                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    )
}
