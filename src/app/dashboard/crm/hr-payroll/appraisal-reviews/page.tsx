'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Star } from 'lucide-react';

export default function AppraisalReviewsPage() {
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                    <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <Star className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">Appraisal Reviews</CardTitle>
                    <CardDescription>
                        Coming Soon: Schedule, conduct, and track employee performance reviews.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">This feature is under development.</p>
                </CardContent>
            </Card>
        </div>
    )
}
