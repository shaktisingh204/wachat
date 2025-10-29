
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Banknote } from 'lucide-react';

export default function BankAccountsPage() {
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                     <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <Banknote className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">Bank Accounts</CardTitle>
                    <CardDescription>
                        Coming Soon: Add and manage your business bank accounts.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">This feature is under development.</p>
                </CardContent>
            </Card>
        </div>
    )
}
