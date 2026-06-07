'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
    Button,
    Card,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    Checkbox,
    Badge,
    EmptyState,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/sabcrm/20ui';
import { AdminUserSearch } from '@/components/20ui-domain/admin-user-search';
import { ApproveUserButton } from '@/components/20ui-domain/approve-user-button';
import { AdminAssignUserPlanDialog } from '@/components/20ui-domain/admin-assign-user-plan-dialog';
import { ImpersonateUserButton } from '@/components/20ui-domain/impersonate-user-button';
import { AdminUserPermissionsDialog } from '@/components/20ui-domain/admin-user-permissions-dialog';
import { AdminUserActionsMenu } from '@/components/20ui-domain/admin-user-actions-menu';
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

    const allSelected = plainUsers.length > 0 && selectedUserIds.length === plainUsers.length;
    const someSelected = selectedUserIds.length > 0 && !allSelected;

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
        <Card padding="none" className="overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--st-border)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                    <span className="font-medium text-[var(--st-text)] text-sm">{total.toLocaleString()} users found</span>
                </div>
                <div className="flex items-center gap-3">
                    {selectedUserIds.length > 0 && (
                        <div className="flex items-center gap-2 bg-[var(--st-bg-secondary)] px-3 py-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)]">
                            <span className="text-sm font-medium text-[var(--st-text)]">{selectedUserIds.length} selected</span>
                            <Button size="sm" variant="outline" onClick={handleBulkApprove} disabled={isApproving}>
                                {isApproving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                                Approve
                            </Button>
                            <div className="flex items-center gap-2 border-l border-[var(--st-border)] pl-2">
                                <Select value={bulkPlanId} onValueChange={setBulkPlanId}>
                                    <SelectTrigger aria-label="Bulk assign plan" className="min-w-[160px]">
                                        <SelectValue placeholder="Select Plan..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {allPlans.map(p => (
                                            <SelectItem key={p._id.toString()} value={p._id.toString()}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button size="sm" variant="primary" onClick={handleBulkAssignPlan} disabled={isAssigning || !bulkPlanId}>
                                    {isAssigning && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                                    Assign Plan
                                </Button>
                            </div>
                        </div>
                    )}
                    <div className="w-72">
                        <AdminUserSearch placeholder="Search by name or email" />
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <Table>
                    <THead>
                        <Tr>
                            <Th align="center" width={48}>
                                <Checkbox
                                    aria-label="Select all users"
                                    checked={allSelected}
                                    indeterminate={someSelected}
                                    onChange={handleSelectAll}
                                />
                            </Th>
                            <Th>User</Th>
                            <Th>Joined</Th>
                            <Th>Plan</Th>
                            <Th>Status</Th>
                            <Th align="right">Actions</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {plainUsers.length > 0 ? (
                            plainUsers.map((user) => (
                                <Tr key={user._id.toString()}>
                                    <Td align="center">
                                        <Checkbox
                                            aria-label={`Select ${user.name}`}
                                            checked={selectedUserIds.includes(user._id.toString())}
                                            onChange={() => handleSelectOne(user._id.toString())}
                                        />
                                    </Td>
                                    <Td>
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-[var(--st-bg-secondary)] border border-[var(--st-border)] flex items-center justify-center shrink-0">
                                                <span className="text-xs font-bold text-[var(--st-text)]">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-medium text-[var(--st-text)]">{user.name}</p>
                                                <p className="text-xs text-[var(--st-text-secondary)]">{user.email}</p>
                                            </div>
                                        </div>
                                    </Td>
                                    <Td className="text-xs text-[var(--st-text-secondary)]">
                                        {new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </Td>
                                    <Td>
                                        <Badge tone="neutral">{user.plan?.name || 'N/A'}</Badge>
                                    </Td>
                                    <Td>
                                        {user.isSuspended ? (
                                            <Badge tone="danger">
                                                <Ban className="h-3 w-3" aria-hidden="true" />
                                                Suspended
                                            </Badge>
                                        ) : user.isApproved ? (
                                            <Badge tone="success" dot>Approved</Badge>
                                        ) : (
                                            <Badge tone="warning" dot>Pending</Badge>
                                        )}
                                    </Td>
                                    <Td align="right">
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
                                    </Td>
                                </Tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} className="px-6 py-12">
                                    <EmptyState
                                        icon={Users}
                                        title="No users found"
                                        description="No users match your search. Try a different name or email."
                                    />
                                </td>
                            </tr>
                        )}
                    </TBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-3 border-t border-[var(--st-border)] flex items-center justify-between">
                <span className="text-xs text-[var(--st-text-secondary)]">Page {currentPage} of {totalPages > 0 ? totalPages : 1}</span>
                <div className="flex gap-2">
                    {currentPage > 1 ? (
                        <Link href={`/admin/dashboard/users?page=${currentPage - 1}${query ? `&query=${query}` : ''}`}>
                            <Button variant="outline" size="sm">Previous</Button>
                        </Link>
                    ) : (
                        <Button variant="outline" size="sm" disabled>Previous</Button>
                    )}
                    {currentPage < totalPages ? (
                        <Link href={`/admin/dashboard/users?page=${currentPage + 1}${query ? `&query=${query}` : ''}`}>
                            <Button variant="outline" size="sm">Next</Button>
                        </Link>
                    ) : (
                        <Button variant="outline" size="sm" disabled>Next</Button>
                    )}
                </div>
            </div>
        </Card>
    );
}
