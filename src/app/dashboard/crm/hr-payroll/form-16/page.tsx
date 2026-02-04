'use server';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from 'lucide-react';

export default async function Form16Page() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
                    <FileText className="h-8 w-8 text-primary" />
                    Form 16 Generation
                </h1>
                <p className="text-muted-foreground">Download Annual Tax Statements (Part A & Part B) for your employees.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Generate Form 16</CardTitle>
                    <CardDescription>Select Financial Year to generate reports.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-4 items-center p-4 border rounded bg-muted/50">
                        <div className="flex-1">
                            <h3 className="font-semibold">Financial Year 2024-2025</h3>
                            <p className="text-sm text-muted-foreground">Period: April 2024 - March 2025</p>
                        </div>
                        <Button disabled>
                            Generate All
                        </Button>
                    </div>

                    <div className="text-center py-8 text-muted-foreground">
                        <p>Payroll data must be finalized for the complete financial year to generate Form 16.</p>
                        <p className="text-sm mt-2">Currently showing sample/placeholder as full FY data is pending.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
