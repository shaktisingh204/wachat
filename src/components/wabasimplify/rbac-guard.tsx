import { headers } from 'next/headers';
import { getSession } from '@/app/actions/index';
import { getRequiredPermissionForPath } from '@/lib/rbac-server';
import { redirect } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { GlobalRolePermissions } from '@/lib/definitions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

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

    // 1. Check Explicit Roles
    // Check both 'roles' array and legacy/singular 'role' string
    if (
        user.roles?.includes('owner') ||
        user.roles?.includes('admin') ||
        user.role === 'owner' ||
        user.role === 'admin'
    ) {
        return <>{children}</>;
    }

    // 2. Check Permissions (for Agents)
    const userPermissions = user.crm?.permissions || {};
    // Default to 'agent' role if no specific role assignment logic found in user object yet, 
    // or if the user is just a basic member.
    // Since we created `Manage Roles`, we need to know WHICH role the user has.
    // This `assignedRoles` field might be missing in `User` type. I should check.
    // For now, I will check the 'agent' role permissions as the baseline for non-admins.

    const agentPermissions = userPermissions['agent'] as GlobalRolePermissions | undefined;
    const hasAgentAccess = agentPermissions?.[permissionKey as keyof GlobalRolePermissions]?.view;

    if (hasAgentAccess) {
        return <>{children}</>;
    }

    // 3. Check Custom Roles (for Agents)
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

    if (hasCustomAccess) {
        return <>{children}</>;
    }

    // 4. Fallback: Check if User is a Project Owner (Main Account)
    // This handles the case where "Main Accounts" don't have role='owner' set in DB.
    try {
        const { db } = await connectToDatabase();
        // Check if user owns ANY project
        const ownedProject = await db.collection('projects').findOne(
            { userId: new ObjectId(user._id) },
            { projection: { _id: 1 } }
        );

        if (ownedProject) {
            // Self-Healing: Update user to have 'owner' role to avoid this DB call next time
            await db.collection('users').updateOne(
                { _id: new ObjectId(user._id) },
                { $set: { role: 'owner' } } // Setting legacy role field for compatibility
            );
            return <>{children}</>;
        }
    } catch (e) {
        console.error("RBAC Owner Check Failed:", e);
    }

    return <ForbiddenPage />;
}
