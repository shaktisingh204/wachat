'use server';

export const dynamic = 'force-dynamic';

import { getCrmAppraisalReviews } from '@/app/actions/crm-hr-appraisals.actions';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from "@/components/ui/badge";
import { Star, FileText } from 'lucide-react';
import { format } from 'date-fns';

export default async function AppraisalReviewsPage() {
    const reviews = await getCrmAppraisalReviews();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
                    <FileText className="h-8 w-8 text-primary" />
                    Appraisal Reviews
                </h1>
                <p className="text-muted-foreground">Performance evaluations and feedback.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Performance Reviews</CardTitle>
                    <CardDescription>History of employee appraisals.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Review Date</TableHead>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Reviewer</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Overall Rating</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reviews.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No appraisals found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    reviews.map((review: any) => {
                                        // Calculate average rating
                                        const ratings = Object.values(review.ratings || {}).filter(v => typeof v === 'number') as number[];
                                        const average = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;

                                        return (
                                            <TableRow key={review._id.toString()}>
                                                <TableCell>{format(new Date(review.reviewDate), 'PP')}</TableCell>
                                                <TableCell className="font-medium">
                                                    {review.employeeInfo?.firstName} {review.employeeInfo?.lastName}
                                                </TableCell>
                                                <TableCell>
                                                    {review.reviewerInfo?.name || 'Unknown'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={review.status === 'Completed' ? 'default' : 'secondary'}>
                                                        {review.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right flex justify-end items-center gap-1">
                                                    <span className="font-bold">{average.toFixed(1)}</span> <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
