
'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { Calendar } from 'lucide-react';

export default function InstagramMessagesPage() {
    return (
         <Card className="text-center py-20">
            <CardHeader>
                <CardTitle>Coming Soon!</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">The Instagram messages inbox is under development.</p>
            </CardContent>
        </Card>
    );
}
