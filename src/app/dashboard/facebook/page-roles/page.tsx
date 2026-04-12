'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { getPageRoles, getBlockedProfiles, blockProfile, unblockProfile } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ShieldCheck, Ban, UserPlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function PageRolesSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        </div>
    );
}

export default function PageRolesPage() {
    const [roles, setRoles] = useState<any[]>([]);
    const [blocked, setBlocked] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [isActing, startActTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [blockInput, setBlockInput] = useState('');

    const fetchData = useCallback(() => {
        if (!projectId) return;
        startTransition(async () => {
            const [rolesRes, blockedRes] = await Promise.all([
                getPageRoles(projectId),
                getBlockedProfiles(projectId),
            ]);

            if (rolesRes.error) setError(rolesRes.error);
            else setRoles(rolesRes.roles || []);

            if (blockedRes.profiles) setBlocked(blockedRes.profiles);
        });
    }, [projectId]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        fetchData();
    }, [projectId, fetchData]);

    const handleBlock = () => {
        if (!projectId || !blockInput.trim()) return;
        startActTransition(async () => {
            const result = await blockProfile(blockInput.trim(), projectId);
            if (result.error) setError(result.error);
            else {
                setBlockInput('');
                fetchData();
            }
        });
    };

    const handleUnblock = (profileId: string) => {
        if (!projectId) return;
        startActTransition(async () => {
            const result = await unblockProfile(profileId, projectId);
            if (result.error) setError(result.error);
            else fetchData();
        });
    };

    if (isLoading && roles.length === 0 && blocked.length === 0) {
        return <PageRolesSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <ShieldCheck className="h-8 w-8" />
                    Page Roles & Blocked Profiles
                </h1>
                <p className="text-muted-foreground mt-2">
                    Manage page roles and blocked profiles.
                </p>
            </div>

            {!projectId ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>Please select a project from the main dashboard.</AlertDescription>
                </Alert>
            ) : error ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : (
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Roles */}
                    <Card className="card-gradient card-gradient-blue">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4" /> Page Roles ({roles.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {roles.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Role</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {roles.map((role: any) => (
                                            <TableRow key={role.id || role.name}>
                                                <TableCell className="font-medium text-sm">{role.name}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">{role.role}</Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-8">No roles found.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Blocked Profiles */}
                    <Card className="card-gradient card-gradient-blue">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Ban className="h-4 w-4" /> Blocked Profiles ({blocked.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Block input */}
                            <div className="flex gap-2">
                                <Input
                                    value={blockInput}
                                    onChange={(e) => setBlockInput(e.target.value)}
                                    placeholder="Profile ID to block"
                                />
                                <Button onClick={handleBlock} disabled={isActing || !blockInput.trim()}>
                                    <UserPlus className="h-4 w-4 mr-1" /> Block
                                </Button>
                            </div>

                            {blocked.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead className="w-24"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {blocked.map((profile: any) => (
                                            <TableRow key={profile.id}>
                                                <TableCell className="font-medium text-sm">{profile.name || profile.id}</TableCell>
                                                <TableCell>
                                                    <Button variant="outline" size="sm" onClick={() => handleUnblock(profile.id)} disabled={isActing}>
                                                        Unblock
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No blocked profiles.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
