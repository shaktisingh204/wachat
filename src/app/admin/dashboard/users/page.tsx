import type { Metadata } from 'next';
import { getUsersForAdmin, getPlans } from '@/app/actions/index';
import type { WithId, User, Plan } from '@/lib/definitions';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AdminUserSearch } from '@/components/wabasimplify/admin-user-search';
import { ApproveUserButton } from '@/components/wabasimplify/approve-user-button';
import { AdminAssignUserPlanDialog } from '@/components/wabasimplify/admin-assign-user-plan-dialog';
import { ImpersonateUserButton } from '@/components/wabasimplify/impersonate-user-button';
import { AdminUserPermissionsDialog } from '@/components/wabasimplify/admin-user-permissions-dialog';
import { Users, CheckCircle, Clock } from 'lucide-react';

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
    } catch {
        // fail gracefully
    }

    const totalPages = Math.ceil(total / USERS_PER_PAGE);
    const plainUsers = JSON.parse(JSON.stringify(users)) as (WithId<User> & { plan?: WithId<Plan>; isApproved?: boolean; customPermissions?: any })[];

    const approved = plainUsers.filter(u => u.isApproved).length;
    const pending = plainUsers.filter(u => !u.isApproved).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Users</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage accounts, permissions, and plans.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600">
                        <CheckCircle className="h-3.5 w-3.5" />
                        {approved} approved
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-600">
                        <Clock className="h-3.5 w-3.5" />
                        {pending} pending
                    </div>
                </div>
            </div>

            {/* Table card */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-500" />
                        <span className="font-medium text-slate-900 text-sm">{total.toLocaleString()} users found</span>
                    </div>
                    <div className="w-72">
                        <AdminUserSearch placeholder="Search by name or email…" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Joined</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Plan</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {plainUsers.length > 0 ? (
                                plainUsers.map((user) => (
                                    <tr key={user._id.toString()} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center shrink-0">
                                                    <span className="text-xs font-bold text-slate-900">
                                                        {user.name.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-900">{user.name}</p>
                                                    <p className="text-xs text-slate-500">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 text-xs text-slate-500">
                                            {new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                                                {user.plan?.name || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            {user.isApproved ? (
                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                                    Approved
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                                                    Pending
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center justify-end gap-1">
                                                <ImpersonateUserButton userId={user._id.toString()} userName={user.name} />
                                                <AdminUserPermissionsDialog
                                                    userId={user._id.toString()}
                                                    userName={user.name}
                                                    initialPermissions={user.customPermissions}
                                                />
                                                <AdminAssignUserPlanDialog
                                                    userId={user._id.toString()}
                                                    userName={user.name}
                                                    currentPlanId={user.planId?.toString()}
                                                    allPlans={allPlans}
                                                />
                                                {!user.isApproved && (
                                                    <ApproveUserButton userId={user._id.toString()} />
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                                        No users found matching your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Page {currentPage} of {totalPages > 0 ? totalPages : 1}</span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild disabled={currentPage <= 1}
                            className="border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-40">
                            <Link href={`/admin/dashboard/users?page=${currentPage - 1}${query ? `&query=${query}` : ''}`}>Previous</Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild disabled={currentPage >= totalPages}
                            className="border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-40">
                            <Link href={`/admin/dashboard/users?page=${currentPage + 1}${query ? `&query=${query}` : ''}`}>Next</Link>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
