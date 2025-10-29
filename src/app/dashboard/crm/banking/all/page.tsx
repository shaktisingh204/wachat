
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Landmark, Plus } from "lucide-react";
import { CrmAddPaymentAccountDialog } from "@/components/wabasimplify/crm-add-payment-account-dialog";

export default function AllPaymentAccountsPage() {
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                    <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <Landmark className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">All Payment Accounts</CardTitle>
                    <CardDescription>
                        Consolidate and manage all your bank accounts, employee accounts, and other payment methods in one place.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                     <CrmAddPaymentAccountDialog />
                </CardContent>
            </Card>
        </div>
    )
}
