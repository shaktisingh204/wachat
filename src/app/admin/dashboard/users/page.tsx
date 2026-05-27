import { Button } from '@/components/zoruui';
import {
  getUsersForAdmin,
  getPlans } from '@/app/actions/index';
import type { WithId,
  User,
  Plan } from '@/lib/definitions';
import Link from 'next/link';

import type { Metadata } from 'next';

import { AdminUserSearch } from '@/components/zoruui-domain/admin-user-search';
import { ApproveUserButton } from '@/components/zoruui-domain/approve-user-button';
import { AdminAssignUserPlanDialog } from '@/components/zoruui-domain/admin-assign-user-plan-dialog';
import { ImpersonateUserButton } from '@/components/zoruui-domain/impersonate-user-button';
import { AdminUserPermissionsDialog } from '@/components/zoruui-domain/admin-user-permissions-dialog';
import { AdminUserActionsMenu } from '@/components/zoruui-domain/admin-user-actions-menu';
import { Users, CheckCircle, Clock, Ban } from 'lucide-react';

import { AdminUsersTableView } from '@/components/zoruui-domain/admin-users-table-view';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'User Management | SabNode Admin' };

const USERS_PER_PAGE = 12;

export default async function AdminUsersPage({
    searchParams,
}: {
    searchParams?: Promise<{ query?: string; page?: string }>;
}) {
    const sp = await searchParams;
    const query = typeof sp?.query === 'string' ? sp.query : '';
    const currentPage = typeof sp?.page === 'string' ? Number(sp.page) : 1;

    let users: (WithId<User> & { plan?: WithId<Plan> | null })[] = [];
    let total = 0;
    let allPlans: WithId<Plan>[] = [];

    try {
        const [userData, plansData] = await Promise.all([
            getUsersForAdmin(currentPage, USERS_PER_PAGE, query),
            getPlans(),
        ]);
        users = userData.users;
        total = userData.total;
        allPlans = plansData;
    } catch (e) {
        // Log the error that was silently failing
        console.error('Error fetching admin users page data:', e);
    }

    const totalPages = Math.ceil(total / USERS_PER_PAGE);
    const plainUsers = users.map(user => ({
        ...user,
        _id: user._id.toString(),
        planId: user.planId?.toString(),
        plan: user.plan ? { ...user.plan, _id: user.plan._id.toString() } : undefined
    })) as unknown as (WithId<User> & { plan?: WithId<Plan>; isApproved?: boolean; isSuspended?: boolean; customPermissions?: any })[];

    const approved = plainUsers.filter(u => u.isApproved && !u.isSuspended).length;
    const pending = plainUsers.filter(u => !u.isApproved).length;
    const suspended = plainUsers.filter(u => u.isSuspended).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zoru-ink">Users</h1>
                    <p className="text-sm text-zoru-ink-muted mt-1">Manage accounts, permissions, and plans.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 rounded-full border border-zoru-line bg-zoru-surface-2 px-3 py-1.5 text-xs font-medium text-zoru-ink">
                        <CheckCircle className="h-3.5 w-3.5" />
                        {approved} approved
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full border border-zoru-line bg-zoru-surface-2 px-3 py-1.5 text-xs font-medium text-zoru-ink">
                        <Clock className="h-3.5 w-3.5" />
                        {pending} pending
                    </div>
                    {suspended > 0 && (
                        <div className="flex items-center gap-1.5 rounded-full border border-zoru-line bg-zoru-surface-2 px-3 py-1.5 text-xs font-medium text-zoru-ink">
                            <Ban className="h-3.5 w-3.5" />
                            {suspended} suspended
                        </div>
                    )}
                </div>
            </div>

            {/* Table card */}
            <AdminUsersTableView 
                plainUsers={plainUsers} 
                allPlans={allPlans} 
                total={total} 
                currentPage={currentPage} 
                totalPages={totalPages} 
                query={query} 
            />
        </div>
    );
}
