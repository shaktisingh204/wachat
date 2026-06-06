import "@/components/sabcrm/20ui/zoru-legacy.css";

import { Card, CardHeader, CardTitle, CardBody, CardDescription } from '@/components/sabcrm/20ui/compat';
import { Clock, Mail } from "lucide-react";

export default function PendingApprovalPage() {
    return (
        <div className="zoruui min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            <div className="flex items-center justify-center min-h-screen bg-[var(--st-bg-secondary)] p-4">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <div className="mx-auto bg-[var(--st-text)]/10 p-4 rounded-full w-fit mb-4">
                            <Clock className="h-12 w-12 text-[var(--st-text)]" />
                        </div>
                        <CardTitle className="text-2xl">Account Pending Approval</CardTitle>
                        <CardDescription>Your account has been created successfully and is now awaiting administrator approval.</CardDescription>
                    </CardHeader>
                    <CardBody>
                        <p className="text-[var(--st-text-secondary)]">You will receive an email notification once your account has been approved. If you have any questions, please contact our support team.</p>
                        <div className="mt-6">
                            <a href="mailto:support@sabnode.com" className="flex items-center justify-center gap-2 text-[var(--st-text)] hover:underline">
                                <Mail className="h-4 w-4" />
                                support@sabnode.com
                            </a>
                        </div>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
