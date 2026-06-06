import { notFound } from 'next/navigation';

import React from 'react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getPortalUserById } from '@/app/actions/crm-portal.actions';
import { PortalEditForm } from './edit-form';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PortalEditPage({ params }: PageProps) {
    const { id } = await params;
    const user = await getPortalUserById(id);
    if (!user) notFound();

    const status = String(user.status ?? 'pending');

    return (
        <EntityDetailShell
            eyebrow="PORTAL"
            title={`Edit · ${user.name || user.email || 'portal user'}`}
            back={{
                href: `/dashboard/crm/portal/${id}`,
                label: 'Back to portal user',
            }}
            status={{
                label: status,
                tone:
                    status === 'active'
                        ? 'green'
                        : status === 'suspended'
                          ? 'red'
                          : 'amber',
            }}
            rightRail={
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Identity</CardTitle>
                        </CardHeader>
                        <CardBody>
                            <div className="space-y-1.5 text-[12.5px]">
                                <div>
                                    <div className="text-[var(--st-text-secondary)]">Email</div>
                                    <div className="break-words text-[var(--st-text)]">
                                        {user.email || '—'}
                                    </div>
                                </div>
                                <div className="border-t border-[var(--st-border)] pt-2">
                                    <div className="text-[var(--st-text-secondary)]">Portal type</div>
                                    <div className="capitalize text-[var(--st-text)]">
                                        {user.portalType || 'customer'}
                                    </div>
                                </div>
                                {user.linkedEntityName ? (
                                    <div className="border-t border-[var(--st-border)] pt-2">
                                        <div className="text-[var(--st-text-secondary)]">Linked to</div>
                                        <div className="text-[var(--st-text)]">
                                            {user.linkedEntityName}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </CardBody>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Access</CardTitle>
                        </CardHeader>
                        <CardBody>
                            <div className="space-y-1.5 text-[12.5px]">
                                <div>
                                    <div className="text-[var(--st-text-secondary)]">Role</div>
                                    <div className="capitalize text-[var(--st-text)]">
                                        {user.role || 'viewer'}
                                    </div>
                                </div>
                                <div className="border-t border-[var(--st-border)] pt-2">
                                    <div className="text-[var(--st-text-secondary)]">Last IP address</div>
                                    <div className="text-[var(--st-text)]">
                                        {user.lastIp || 'Unknown'}
                                    </div>
                                </div>
                                <div className="border-t border-[var(--st-border)] pt-2">
                                    <div className="text-[var(--st-text-secondary)]">Capabilities</div>
                                    <div className="text-[var(--st-text)]">
                                        {Array.isArray(user.capabilities)
                                            ? user.capabilities.length
                                            : 0}{' '}
                                        granted
                                    </div>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </>
            }
            audit={
                <React.Suspense fallback={<div className="h-64 w-full animate-pulse bg-[var(--st-bg-muted)] rounded-md" />}>
                    <EntityAuditTimeline entityKind="portal_user" entityId={id} />
                </React.Suspense>
            }
        >
            <PortalEditForm user={{ ...user, _id: String(user._id ?? id) }} />
        </EntityDetailShell>
    );
}
