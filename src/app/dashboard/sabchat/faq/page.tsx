
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

export default function FaqPage() {
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                    <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <HelpCircle className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">FAQ Management</CardTitle>
                    <CardDescription>
                        Coming Soon: Build a list of frequently asked questions to help your AI assistant and your team answer queries faster.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">This feature is under development.</p>
                </CardContent>
            </Card>
        </div>
    )
}
