
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Package } from 'lucide-react';

export default function AllItemsPage() {
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                    <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <Package className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">All Items</CardTitle>
                    <CardDescription>
                        Coming Soon: A comprehensive view of all your inventory items, stock levels, and valuations.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">This feature is under development.</p>
                </CardContent>
            </Card>
        </div>
    )
}
