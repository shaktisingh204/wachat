
'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function SabChatVisitorsPage() {
    return (
        <Card className="text-center py-20">
            <CardHeader>
                <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                    <Users className="h-12 w-12 text-primary" />
                </div>
                <CardTitle className="mt-4 text-2xl">Live Visitors</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Coming Soon: See who is on your website right now.</p>
            </CardContent>
        </Card>
    );
}
