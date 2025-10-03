
'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Send, Users, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function SmsDashboardPage() {
    return (
        <div className="space-y-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Campaigns Sent</CardTitle>
                        <Send className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">0</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">0</div>
                    </CardContent>
                </Card>
            </div>
            <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>Welcome to the SMS Suite!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground mb-4">You haven't configured an SMS provider yet. Get started by setting one up.</p>
                    <Button asChild>
                        <Link href="/dashboard/sms/settings">Go to SMS Settings</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
