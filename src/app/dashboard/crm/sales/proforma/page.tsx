
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgeInfo, PlayCircle, Plus, Upload } from "lucide-react";

export default function ProformaInvoicesPage() {
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                    <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <BadgeInfo className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">Proforma Invoices</CardTitle>
                    <CardDescription>
                        Create Proforma Invoices With Customisable Templates. 1-click Share via PDF, Print, or Link over WhatsApp or Email. Record & Track Payments. And more...
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
                        Create your first proforma invoice
                    </Button>
                     <Button variant="secondary">
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Proforma invoices
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
