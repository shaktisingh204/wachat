
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { History } from 'lucide-react';

export default function AllTransactionsPage() {
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                    <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <History className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">All Transactions Report</CardTitle>
                    <CardDescription>
                        Coming Soon: A complete log of all inventory movements, including sales, purchases, and adjustments.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">This feature is under development.</p>
                </CardContent>
            </Card>
        </div>
    )
}
