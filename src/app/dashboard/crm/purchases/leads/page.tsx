
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Contact, PlayCircle, Upload } from "lucide-react";
import Link from 'next/link';

export default function VendorLeadsPage() {
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                    <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <Contact className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">Vendor Leads</CardTitle>
                    <CardDescription>
                        Manage potential vendors and suppliers. Track leads, assign to team members, and convert them to vendors.
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
                        <Link href="/dashboard/crm/purchases/vendors/new">
                            <Plus className="mr-2 h-4 w-4" />
                            Add New Vendor Lead
                        </Link>
                    </Button>
                     <Button variant="secondary" disabled>
                        <Upload className="mr-2 h-4 w-4" />
                        Import Leads
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
