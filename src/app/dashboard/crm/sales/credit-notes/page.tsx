
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Repeat, PlayCircle, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function CreditNotesPage() {
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                    <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <Repeat className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">Credit Notes</CardTitle>
                    <CardDescription>
                        Provide Rebates To Customers With Credit Notes. Create, Share, Track, and Manage All Credit Notes In One Place.
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
                        <Link href="/dashboard/crm/sales/credit-notes/new">
                            <Plus className="mr-2 h-4 w-4" />
                            Create First Credit Note
                        </Link>
                    </Button>
                     <Button variant="secondary">
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Credit Notes
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
