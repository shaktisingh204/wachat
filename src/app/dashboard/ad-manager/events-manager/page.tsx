'use client';

import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function EventsManagerPage() {
    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <BarChart3 className="h-6 w-6" /> Events manager
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Monitor pixel events, conversion API traffic and offline events.
                </p>
            </div>

            <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                    <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="mt-3 font-semibold">Open your pixel to see events</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Pick a pixel from the Pixels page to drill into event-level data.
                    </p>
                    <Button asChild className="mt-4 bg-[#1877F2] hover:bg-[#1877F2]/90">
                        <Link href="/dashboard/ad-manager/pixels">Go to pixels</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
