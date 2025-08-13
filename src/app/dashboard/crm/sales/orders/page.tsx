
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Plus } from 'lucide-react';
import Link from 'next/link';

export default function SalesOrdersPage() {
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                    <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <ShoppingBag className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">Sales Orders</CardTitle>
                    <CardDescription>
                       Create, Share, and Track Sales Orders. Anticipate Future Revenues and Keep Track of Order Fulfillment.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild>
                        <Link href="/dashboard/crm/sales/orders/new">
                             <Plus className="mr-2 h-4 w-4" />
                            Create First Sales Order
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
