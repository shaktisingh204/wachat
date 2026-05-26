import "@/styles/zoruui.css";

import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardContent, ZoruCardDescription } from "@/components/zoruui";
import { Clock, Mail } from "lucide-react";

export default function PendingApprovalPage() {
    return (
        <div className="zoruui min-h-screen bg-zoru-bg text-zoru-ink">
            <div className="flex items-center justify-center min-h-screen bg-zoru-surface p-4">
                <Card className="w-full max-w-md text-center">
                    <ZoruCardHeader>
                        <div className="mx-auto bg-zoru-primary/10 p-4 rounded-full w-fit mb-4">
                            <Clock className="h-12 w-12 text-zoru-primary" />
                        </div>
                        <ZoruCardTitle className="text-2xl">Account Pending Approval</ZoruCardTitle>
                        <ZoruCardDescription>Your account has been created successfully and is now awaiting administrator approval.</ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <p className="text-zoru-ink-muted">You will receive an email notification once your account has been approved. If you have any questions, please contact our support team.</p>
                        <div className="mt-6">
                            <a href="mailto:support@sabnode.com" className="flex items-center justify-center gap-2 text-zoru-primary hover:underline">
                                <Mail className="h-4 w-4" />
                                support@sabnode.com
                            </a>
                        </div>
                    </ZoruCardContent>
                </Card>
            </div>
        </div>
    );
}
