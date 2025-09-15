
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { FilePlus } from 'lucide-react';

export default function PurchaseOrdersPage() {
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                    <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <FilePlus className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">Purchase Orders</CardTitle>
                    <CardDescription>
                        Coming Soon: Create, manage, and send purchase orders to your vendors directly from the CRM.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">This feature is under development.</p>
                </CardContent>
            </Card>
        </div>
    )
}
