
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";

export default function ChartOfAccountsPage() {
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                    <CardTitle className="mt-4 text-2xl">Chart of Accounts</CardTitle>
                    <CardDescription>
                        Coming Soon: Manage your financial accounts, including assets, liabilities, income, and expenses.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">This feature is under development.</p>
                </CardContent>
            </Card>
        </div>
    )
}
