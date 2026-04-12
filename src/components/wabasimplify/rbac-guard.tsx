import { headers } from 'next/headers';
import { getSession } from '@/app/actions/index';
import { getRequiredPermissionForPath } from '@/lib/rbac-server';
import { ShieldOff, Home, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { GlobalRolePermissions } from '@/lib/definitions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

function ForbiddenPage() {
    return (
        <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center">
            {/* Glassmorphism card */}
            <div className="relative max-w-md w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/20 p-10 overflow-hidden">
                {/* Subtle glow blob */}
                <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

                {/* Icon */}
                <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-inner">
                    <ShieldOff className="h-8 w-8 text-muted-foreground" />
                </div>

                {/* Text */}
                <h1 className="relative text-2xl font-semibold tracking-tight mb-2">
                    Access Restricted
                </h1>
                <p className="relative text-sm text-muted-foreground leading-relaxed mb-8">
                    You don&apos;t have permission to view this page.
                    If you think this is wrong, reach out to your admin.
                </p>

                {/* Actions */}
                <div className="relative flex gap-3 justify-center">
                    <Button asChild size="sm" className="gap-2 rounded-xl bg-primary/90 hover:bg-primary shadow-md">
                        <Link href="/dashboard">
                            <Home className="h-4 w-4" />
                            Go Home
                        </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="gap-2 rounded-xl border-white/10 bg-white/5 hover:bg-white/10">
                        <Link href="/dashboard/team/team-chat">
                            <MessageSquare className="h-4 w-4" />
                            Contact Admin
                        </Link>
                    </Button>
                </div>
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

    // =========================================================================
    // MAIN ACCOUNT OWNER FAST-PATH
    // =========================================================================
    // A "main account owner" is anyone who signed up and created a project — they
    // are NEVER gated by plan restrictions, team roles, or custom-role checks.
    // Team users (sub-users under a main account) are the only ones subject to
    // the plan permission ceiling and per-role gating below.
    //
    // We identify main account owners in three ways, each cheaper than the last:
    //   1. Explicit `role`/`roles` field says owner/admin
    //   2. `user.ownedProjectIds` (cached list on the session) is non-empty
    //   3. Fallback MongoDB lookup against `projects.userId` (also self-heals the
    //      user doc so step 1 takes over on subsequent requests)
    // -------------------------------------------------------------------------

    const hasExplicitOwnerRole =
        user.roles?.includes('owner') ||
        user.roles?.includes('admin') ||
        user.role === 'owner' ||
        user.role === 'admin';

    if (hasExplicitOwnerRole) {
        return <>{children}</>;
    }

    // Step 2 — Session-cached ownership flag. `getSession` may attach
    // `ownedProjectIds` or an `isProjectOwner` boolean. Check both to avoid a DB hit.
    const sessionOwnerHint =
        (user as any).isProjectOwner === true ||
        (Array.isArray((user as any).ownedProjectIds) &&
            (user as any).ownedProjectIds.length > 0);

    if (sessionOwnerHint) {
        return <>{children}</>;
    }

    // Step 3 — Definitive DB lookup. We ask Mongo a single question:
    //   "Does this user appear in ANY project, and in what capacity?"
    // The query matches projects where either:
    //   a) user is the direct owner (`project.userId`), OR
    //   b) user is listed as a team agent (`project.agents[].userId`)
    //
    // This is run BEFORE any plan/role gating so a main account owner whose
    // `role` field was never populated in Mongo cannot be accidentally locked
    // out by their own plan's permission ceiling.
    let isTeamMember = false;
    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(user._id);

        const matches = await db
            .collection('projects')
            .find(
                {
                    $or: [
                        { userId: userObjectId },
                        { 'agents.userId': userObjectId },
                    ],
                },
                { projection: { _id: 1, userId: 1 } },
            )
            .limit(5)
            .toArray();

        const isMainOwner = matches.some(
            (p: any) =>
                p.userId &&
                (p.userId.equals?.(userObjectId) ||
                    p.userId.toString() === userObjectId.toString()),
        );

        if (isMainOwner) {
            // Self-heal: set role on the user doc so future requests skip this lookup.
            await db
                .collection('users')
                .updateOne(
                    { _id: userObjectId },
                    { $set: { role: 'owner' } },
                );
            return <>{children}</>;
        }

        // If the user isn't in any project at all, they also aren't a team
        // member — treat them like a main account (e.g. freshly signed-up user
        // who hasn't created a project yet). Allow through.
        if (matches.length === 0) {
            return <>{children}</>;
        }

        // User is present in at least one project but NOT as the owner →
        // they are a team member / agent and will be subject to gating below.
        isTeamMember = true;
    } catch (e) {
        console.error('RBAC ownership check failed:', e);
        // On DB failure, fail-open for owners rather than locking everyone out.
        return <>{children}</>;
    }

    // =========================================================================
    // TEAM USER GATING
    // =========================================================================
    // The forbidden page is ONLY reachable from this point on, and only for
    // confirmed team members (agents/custom roles under someone else's account).
    // If `isTeamMember` somehow ended up false here, we bail out safely.
    // -------------------------------------------------------------------------
    if (!isTeamMember) {
        return <>{children}</>;
    }

    // Plan permissions — the master overlay enforced on team users only.
    const plan = (user as any).plan;
    if (plan && plan.permissions && permissionKey) {
        const requiredAction = 'view';
        const perms = plan.permissions;
        // Support both the new flat shape { [module]: { view, ... } }
        // and the legacy nested shape { agent: { [module]: { view, ... } } }.
        const planModulePerms =
            perms[permissionKey] ??
            (perms.agent && typeof perms.agent === 'object'
                ? perms.agent[permissionKey]
                : undefined);

        if (planModulePerms && planModulePerms[requiredAction] === false) {
            return <ForbiddenPage />;
        }
    }

    // Agent (default team role) permissions
    const userPermissions = user.crm?.permissions || {};
    const agentPermissions = userPermissions['agent'] as GlobalRolePermissions | undefined;
    if (agentPermissions?.[permissionKey as keyof GlobalRolePermissions]?.view) {
        return <>{children}</>;
    }

    // Custom role permissions
    if (user.crm?.customRoles) {
        const userRole = user.role || 'agent';
        const rolePermissions = userPermissions[userRole] as GlobalRolePermissions | undefined;
        if (rolePermissions?.[permissionKey as keyof GlobalRolePermissions]?.view) {
            return <>{children}</>;
        }
    }

    return <ForbiddenPage />;
}
