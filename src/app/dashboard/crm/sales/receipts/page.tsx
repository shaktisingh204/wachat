
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, PlayCircle, Plus } from "lucide-react";
import Link from "next/link";

export default function PaymentReceiptsPage() {
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                    <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <CreditCard className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">Payment Receipts</CardTitle>
                    <CardDescription>
                        Create, edit and share receipt for the payment received from the clients.
                    </CardDescription>
                     <div className="pt-2">
                        <Button variant="link" className="text-primary">
                            <PlayCircle className="mr-2 h-4 w-4" />
                            Watch Demo Video
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button asChild>
                        <Link href="/dashboard/crm/sales/receipts/new">
                             <Plus className="mr-2 h-4 w-4" />
                            Create First Payment Receipt
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
