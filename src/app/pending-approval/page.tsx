
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Clock, Mail } from "lucide-react";
import Link from 'next/link';

export default function PendingApprovalPage() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-muted p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
                        <Clock className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">Account Pending Approval</CardTitle>
                    <CardDescription>Your account has been created successfully and is now awaiting administrator approval.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">You will receive an email notification once your account has been approved. If you have any questions, please contact our support team.</p>
                    <div className="mt-6">
                        <a href="mailto:support@sabnode.com" className="flex items-center justify-center gap-2 text-primary hover:underline">
                            <Mail className="h-4 w-4" />
                            support@sabnode.com
                        </a>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
