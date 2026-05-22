import { notFound } from 'next/navigation';

import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
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
                        <ZoruCardHeader>
                            <ZoruCardTitle>Identity</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-1.5 text-[12.5px]">
                                <div>
                                    <div className="text-zoru-ink-muted">Email</div>
                                    <div className="break-words text-zoru-ink">
                                        {user.email || '—'}
                                    </div>
                                </div>
                                <div className="border-t border-zoru-line pt-2">
                                    <div className="text-zoru-ink-muted">Portal type</div>
                                    <div className="capitalize text-zoru-ink">
                                        {user.portalType || 'customer'}
                                    </div>
                                </div>
                                {user.linkedEntityName ? (
                                    <div className="border-t border-zoru-line pt-2">
                                        <div className="text-zoru-ink-muted">Linked to</div>
                                        <div className="text-zoru-ink">
                                            {user.linkedEntityName}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </ZoruCardContent>
                    </Card>
                    <Card>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Access</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-1.5 text-[12.5px]">
                                <div>
                                    <div className="text-zoru-ink-muted">Role</div>
                                    <div className="capitalize text-zoru-ink">
                                        {user.role || 'viewer'}
                                    </div>
                                </div>
                                <div className="border-t border-zoru-line pt-2">
                                    <div className="text-zoru-ink-muted">Capabilities</div>
                                    <div className="text-zoru-ink">
                                        {Array.isArray(user.capabilities)
                                            ? user.capabilities.length
                                            : 0}{' '}
                                        granted
                                    </div>
                                </div>
                            </div>
                        </ZoruCardContent>
                    </Card>
                </>
            }
            audit={<EntityAuditTimeline entityKind="portal_user" entityId={id} />}
        >
            <PortalEditForm user={{ ...user, _id: String(user._id ?? id) }} />
        </EntityDetailShell>
    );
}
