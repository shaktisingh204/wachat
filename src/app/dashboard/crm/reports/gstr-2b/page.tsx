
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { FileText } from 'lucide-react';

export default function Gstr2bPage() {
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                    <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <FileText className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">GSTR-2B Purchase Report</CardTitle>
                    <CardDescription>
                        Coming Soon: A summary of your purchase invoices to help with ITC claims.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">This feature is under development.</p>
                </CardContent>
            </Card>
        </div>
    )
}
