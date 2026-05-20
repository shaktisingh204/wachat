/**
 * HRM Employee Self-Service Portal — layout.
 *
 * Server component. Checks whether the logged-in user has an employee
 * profile linked to their account before rendering children. If no
 * profile is found we show a friendly blocked state; the admin can link
 * accounts from the Employees page.
 */

import { getSession } from '@/app/actions/user.actions';
import { getMyEmployeeProfile } from '@/app/actions/hrm-portal.actions';
import {
    ZoruCard,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
    ZoruCardDescription,
} from '@/components/zoruui';
import { UserX } from 'lucide-react';

interface PortalLayoutProps {
    children: React.ReactNode;
}

export default async function PortalLayout({ children }: PortalLayoutProps) {
    const session = await getSession();
    if (!session?.user) {
        // Let the HRM parent layout / middleware handle unauthenticated state.
        return <>{children}</>;
    }

    const profile = await getMyEmployeeProfile(String(session.user._id));

    if (!profile) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <ZoruCard className="max-w-md w-full text-center" variant="soft">
                    <ZoruCardHeader className="items-center gap-3 pb-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2">
                            <UserX className="h-6 w-6 text-zoru-ink-muted" />
                        </div>
                        <div>
                            <ZoruCardTitle className="text-[16px] text-zoru-ink">
                                No employee profile linked
                            </ZoruCardTitle>
                            <ZoruCardDescription className="mt-1 text-[13px] text-zoru-ink-muted">
                                Your account ({session.user.email}) doesn&apos;t have an employee profile linked
                                to it yet. Please ask your HR administrator to link your employee record.
                            </ZoruCardDescription>
                        </div>
                    </ZoruCardHeader>
                    <ZoruCardContent className="pb-6 text-[12.5px] text-zoru-ink-muted">
                        Once linked, your profile, team, and tasks will appear here.
                    </ZoruCardContent>
                </ZoruCard>
            </div>
        );
    }

    return <>{children}</>;
}
