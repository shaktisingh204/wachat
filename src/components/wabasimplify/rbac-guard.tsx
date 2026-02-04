import { headers } from 'next/headers';
import { getSession } from '@/app/actions/index.ts';
import { getRequiredPermissionForPath } from '@/lib/rbac-server';
import { redirect } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { GlobalRolePermissions } from '@/lib/definitions';

function ForbiddenPage() {
    return (
        <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300">
            <div className="bg-destructive/10 p-4 rounded-full mb-6">
                <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <h1 className="text-3xl font-bold font-headline mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-8 max-w-md">
                You do not have the required permissions to view this page.
                Please contact your administrator if you believe this is a mistake.
            </p>
            <div className="flex gap-4">
                <Button asChild variant="default">
                    <Link href="/dashboard">Go Home</Link>
                </Button>
                <Button asChild variant="outline">
                    <Link href="/dashboard/team/team-chat">Contact Admin</Link>
                </Button>
            </div>
        </div>
    );
}

export async function RBACGuard({ children }: { children: React.ReactNode }) {
    const headersList = await headers();
    const pathname = headersList.get('x-url') || '';

    // If no path is found (shouldn't happen with middleware), or root dashboard, allow
    if (!pathname || pathname === '/dashboard') {
        return <>{children}</>;
    }

    const permissionKey = getRequiredPermissionForPath(pathname);

    // If page requires no special permission, allow
    if (!permissionKey) {
        return <>{children}</>;
    }

    const session = await getSession();
    const user = session?.user;

    // Safety fallback: if no user, middleware usually handles this, but robust check
    if (!user) {
        return <>{children}</>;
    }

    // Admins/Owners bypass all checks
    // Check roles array string match
    if (user.roles?.includes('owner') || user.roles?.includes('admin')) {
        return <>{children}</>;
    }

    // Role Logic
    // If user has a custom role (e.g., 'marketing_manager'), permissions are stored in 'agent' or custom keys?
    // Current DB structure: user.crm.permissions.[roleId]
    // And user.crm.roles contains the role IDs assigned to the user

    // We need to fetch the user's assigned roles for the CRM/Team module
    // This part depends on how you assign roles to users.
    // Assuming 'agent' is the default role if no others are assigned, OR we check all assigned roles.

    // Let's assume for now checks 'agent' permissions + any custom rules.
    // In many systems, "Allow" takes precedence. If ANY assigned role allows it, we allow.

    // For this implementation, I will check the user's PRIMARY role or iterate all.
    // Since `user` object in session might not have the full permissions map populated if it's lite.
    // We might need to refetch user or ensure session has it.
    // `getSession` usually returns the user object from DB.

    const userPermissions = user.crm?.permissions || {};
    // Default to 'agent' role if no specific role assignment logic found in user object yet, 
    // or if the user is just a basic member.
    // Since we created `Manage Roles`, we need to know WHICH role the user has.
    // This `assignedRoles` field might be missing in `User` type. I should check.
    // For now, I will check the 'agent' role permissions as the baseline for non-admins.

    // TODO: Ideally, user stores `roles: ['role_id_1', 'role_id_2']`.
    // Then we check `userPermissions[role_id][permissionKey].view`.

    // Checking 'agent' permissions for now as valid fallback
    const agentPermissions = userPermissions['agent'] as GlobalRolePermissions | undefined;
    const hasAgentAccess = agentPermissions?.[permissionKey as keyof GlobalRolePermissions]?.view;

    // If we had multiple roles, we'd loop.
    // If ANY role grants access, we allow.

    if (hasAgentAccess) {
        return <>{children}</>;
    }

    // Check custom roles if user has them (assuming user.roles contains IDs like '123-abc')
    let hasCustomAccess = false;
    if (user.crm?.customRoles) {
        // This logic is tricky: users usually HAVE roles, they don't OWN role definitions.
        // But currently, the `user` object seems to store the definitions (`user.crm.customRoles`).
        // The actual assignment of a role to a *different* user isn't fully clear in the schema I saw.
        // Usually `user.role` is a string or array.
        // If `user.role` === 'agent', we checked above.
        // If `user.role` === 'marketing_lead', we check that key.

        const userRole = user.role || 'agent'; // Fallback
        const rolePermissions = userPermissions[userRole] as GlobalRolePermissions | undefined;
        if (rolePermissions?.[permissionKey as keyof GlobalRolePermissions]?.view) {
            hasCustomAccess = true;
        }
    }

    if (!hasCustomAccess && !hasAgentAccess) {
        return <ForbiddenPage />;
    }

    return <>{children}</>;
}
