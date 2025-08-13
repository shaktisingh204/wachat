
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Truck, Plus, Upload } from "lucide-react";
import Link from 'next/link';

export default function DeliveryChallansPage() {
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                    <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <Truck className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">Delivery Challans</CardTitle>
                    <CardDescription>
                        Create, Share, and Track Delivery Challans for Transportation or Delivery of Goods.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button asChild>
                        <Link href="/dashboard/crm/sales/delivery/new">
                            <Plus className="mr-2 h-4 w-4" />
                            Create First Delivery Challan
                        </Link>
                    </Button>
                     <Button variant="secondary" disabled>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Delivery Challans
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
