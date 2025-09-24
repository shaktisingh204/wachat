
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Users } from "lucide-react";
import Link from 'next/link';

export default function PipelinesPage() {
    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Users className="h-8 w-8" />
                        Pipelines
                    </h1>
                    <p className="text-muted-foreground">Create and manage multiple sales pipelines to track your deals.</p>
                </div>
                <Button asChild>
                    <Link href="#">
                        <Plus className="mr-2 h-4 w-4" />
                        New Pipeline
                    </Link>
                </Button>
            </div>
            
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>No Pipelines Found</CardTitle>
                    <CardDescription>You haven't created any pipelines yet.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Your First Pipeline
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
