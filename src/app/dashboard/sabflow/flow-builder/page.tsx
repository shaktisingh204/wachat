
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Zap, GitFork } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SabFlowBuilderPage() {
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="text-center max-w-2xl">
                <CardHeader>
                    <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                         <GitFork className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">The SabFlow Builder</CardTitle>
                    <CardDescription>
                        Coming Soon: A powerful new flow builder to connect and automate 5000+ third-party applications.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">This feature is under development.</p>
                     <Button variant="outline" className="mt-4" disabled>
                        <Zap className="mr-2 h-4 w-4"/>
                        Browse App Connections
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
