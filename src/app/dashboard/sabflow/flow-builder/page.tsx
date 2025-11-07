
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Zap, GitFork } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function SabFlowBuilderPage() {
    return (
        <div className="flex justify-center items-center h-full p-4">
            <Card className="text-center max-w-2xl animate-fade-in-up">
                <CardHeader>
                    <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <GitFork className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">The SabFlow Builder</CardTitle>
                    <CardDescription>
                        This is where the magic happens. Create powerful, multi-step workflows that connect all your favorite apps.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">
                        The advanced flow builder is under construction and will be available soon.
                    </p>
                     <Button variant="outline" className="mt-4" asChild>
                        <Link href="/dashboard/sabflow/connections">
                            <Zap className="mr-2 h-4 w-4"/>
                            Browse App Connections
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
