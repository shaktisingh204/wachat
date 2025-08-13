
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, Plus, Upload, FileText as FileTextIcon } from "lucide-react";
import Link from 'next/link';

export default function InvoicesPage() {
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                    <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <FileTextIcon className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">Invoices</CardTitle>
                    <CardDescription>
                        Create Invoices With Customisable Templates. 1-click Share via PDF, Print, or Link over WhatsApp or Email. Record & Track Payments. And more...
                    </CardDescription>
                     <div className="pt-2">
                        <Button variant="link" className="text-primary">
                            <PlayCircle className="mr-2 h-4 w-4" />
                            Watch Demo Video
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Create your first invoice
                    </Button>
                     <Button variant="secondary">
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Invoices
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
