'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/zoruui';
import { AdminUserSearch } from '@/components/wabasimplify/admin-user-search';
import { ApproveUserButton } from '@/components/wabasimplify/approve-user-button';
import { AdminAssignUserPlanDialog } from '@/components/wabasimplify/admin-assign-user-plan-dialog';
import { ImpersonateUserButton } from '@/components/wabasimplify/impersonate-user-button';
import { AdminUserPermissionsDialog } from '@/components/wabasimplify/admin-user-permissions-dialog';
import { AdminUserActionsMenu } from '@/components/wabasimplify/admin-user-actions-menu';
import { Users, LoaderCircle, Ban } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { bulkApproveUsers, bulkUpdateUserPlans } from '@/app/actions/admin.actions';

export function AdminUsersTableView({
    plainUsers,
    allPlans,
    total,
    currentPage,
    totalPages,
    query
}: {
    plainUsers: any[];
    allPlans: any[];
    total: number;
    currentPage: number;
    totalPages: number;
    query: string;
}) {
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isApproving, setIsApproving] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);
    const [bulkPlanId, setBulkPlanId] = useState<string>('');
    const { toast } = useToast();

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedUserIds(plainUsers.map(u => u._id.toString()));
        } else {
            setSelectedUserIds([]);
        }
    };

    const handleSelectOne = (id: string) => {
        setSelectedUserIds(prev => 
            prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]
        );
    };

    const handleBulkApprove = async () => {
        if (!selectedUserIds.length) return;
        setIsApproving(true);
        try {
            const res = await bulkApproveUsers(selectedUserIds);
            if (res.success) {
                toast({ title: 'Success', description: 'Selected users approved.' });
                setSelectedUserIds([]);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: res.error || 'Failed to approve.' });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsApproving(false);
        }
    };

    const handleBulkAssignPlan = async () => {
        if (!selectedUserIds.length || !bulkPlanId) return;
        setIsAssigning(true);
        try {
            const res = await bulkUpdateUserPlans(selectedUserIds, bulkPlanId);
            if (res.success) {
                toast({ title: 'Success', description: 'Plan assigned to selected users.' });
                setSelectedUserIds([]);
                setBulkPlanId('');
            } else {
                toast({ variant: 'destructive', title: 'Error', description: res.error || 'Failed to assign plan.' });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsAssigning(false);
        }
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-500" />
                    <span className="font-medium text-slate-900 text-sm">{total.toLocaleString()} users found</span>
                </div>
                <div className="flex items-center gap-3">
                    {selectedUserIds.length > 0 && (
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
                            <span className="text-sm font-medium text-slate-700">{selectedUserIds.length} selected</span>
                            <Button size="sm" variant="outline" onClick={handleBulkApprove} disabled={isApproving}>
                                {isApproving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                Approve
                            </Button>
                            <div className="flex items-center gap-2 border-l border-slate-300 pl-2">
                                <select 
                                    className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    value={bulkPlanId}
                                    onChange={(e) => setBulkPlanId(e.target.value)}
                                >
                                    <option value="">Select Plan...</option>
                                    {allPlans.map(p => (
                                        <option key={p._id.toString()} value={p._id.toString()}>{p.name}</option>
                                    ))}
                                </select>
                                <Button size="sm" onClick={handleBulkAssignPlan} disabled={isAssigning || !bulkPlanId}>
                                    {isAssigning && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                    Assign Plan
                                </Button>
                            </div>
                        </div>
                    )}
                    <div className="w-72">
                        <AdminUserSearch placeholder="Search by name or email…" />
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200">
                            <th className="px-4 py-3 text-left w-12">
                                <input 
                                    type="checkbox" 
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                                    checked={plainUsers.length > 0 && selectedUserIds.length === plainUsers.length}
                                    onChange={handleSelectAll}
                                />
                            </th>
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
                                    <td className="px-4 py-3.5">
                                        <input 
                                            type="checkbox"
                                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                                            checked={selectedUserIds.includes(user._id.toString())}
                                            onChange={() => handleSelectOne(user._id.toString())}
                                        />
                                    </td>
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
                                        {user.isSuspended ? (
                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
                                                <Ban className="h-3 w-3" />
                                                Suspended
                                            </span>
                                        ) : user.isApproved ? (
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
                                            <AdminUserActionsMenu
                                                userId={user._id.toString()}
                                                userName={user.name}
                                                isSuspended={user.isSuspended}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
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
    );
}
