import {
    FileText,
    Inbox,
    Mail,
    MailPlus,
    Send,
    Settings,
    Users,
} from 'lucide-react';

import { Button, Card } from '@/components/zoruui';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';

import {
    HubKpiGrid,
    HubQuickLinkGrid,
    HubRecentList,
    type HubKpi,
    type HubQuickLink,
    type HubRecentRow,
} from '../_components/hub-kpi-grid';
import {
    countByUser,
    formatDate,
    recentByUser,
    startOfMonth,
} from '../_components/hub-data';

export const dynamic = 'force-dynamic';

interface EmailDoc {
    _id: string;
    subject?: string;
    to?: string | string[];
    from?: string;
    status?: string;
    sentAt?: string;
    createdAt?: string;
}

const QUICK_LINKS: HubQuickLink[] = [
    { href: '/dashboard/email', title: 'Open Mail', description: 'Full SabNode mail client — inbox, sent, drafts.', icon: Inbox },
    { href: '/dashboard/email/compose', title: 'Compose', description: 'Write and send a new email.', icon: Send },
    { href: '/dashboard/crm/settings/email-templates', title: 'Email Templates', description: 'Reusable templates for outbound CRM emails.', icon: FileText },
    { href: '/dashboard/crm/contacts', title: 'Contacts', description: 'CRM contacts you can send email to.', icon: Users },
    { href: '/dashboard/crm/settings', title: 'Email Settings', description: 'SMTP / IMAP configuration and signatures.', icon: Settings },
];

export default async function CrmEmailHubPage() {
    const monthStart = startOfMonth();

    const [totalEmails, sentThisMonth, templates, contactsCount, recentEmails] = await Promise.all([
        countByUser('crm_emails'),
        countByUser('crm_emails', { sentAt: { $gte: monthStart }, status: 'sent' }),
        countByUser('crm_email_templates'),
        countByUser('crm_contacts'),
        recentByUser<EmailDoc>('crm_emails', { sortField: 'sentAt', limit: 5 }),
    ]);

    const isConfigured = totalEmails > 0 || templates > 0;

    const kpis: HubKpi[] = [
        {
            label: 'Sent (Month)',
            value: sentThisMonth.toLocaleString(),
            icon: Send,
            href: '/dashboard/email',
        },
        {
            label: 'Templates',
            value: templates,
            icon: FileText,
            href: '/dashboard/crm/settings/email-templates',
        },
        {
            label: 'Contacts',
            value: contactsCount.toLocaleString(),
            icon: Users,
            href: '/dashboard/crm/contacts',
        },
        {
            label: 'Total Threads',
            value: totalEmails.toLocaleString(),
            icon: Mail,
            href: '/dashboard/email',
        },
    ];

    const recentRows: HubRecentRow[] = recentEmails.map((m) => ({
        id: String(m._id),
        primary: m.subject || '(no subject)',
        secondary: Array.isArray(m.to) ? m.to.join(', ') : m.to || m.from || '',
        trailing: formatDate(m.sentAt || m.createdAt),
        href: '/dashboard/email',
    }));

    return (
        <EntityListShell
            title="Email"
            subtitle="Send mail from CRM, manage templates, and open the full mail client."
        >
            <div className="flex flex-col gap-6">
                {!isConfigured ? (
                    <ZoruCard className="p-6">
                        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zoru-surface-2">
                                    <MailPlus className="h-5 w-5 text-zoru-ink" strokeWidth={1.75} />
                                </div>
                                <div>
                                    <p className="text-[14px] font-medium text-zoru-ink">
                                        Email is not configured yet
                                    </p>
                                    <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                                        Configure SMTP to start sending emails from CRM workflows.
                                    </p>
                                </div>
                            </div>
                            <Link href="/dashboard/crm/settings">
                                <ZoruButton variant="outline" size="sm">
                                    Configure SMTP
                                </ZoruButton>
                            </Link>
                        </div>
                    </ZoruCard>
                ) : null}

                <HubKpiGrid kpis={kpis} />
                <HubQuickLinkGrid links={QUICK_LINKS} />
                <HubRecentList
                    title="Recent emails"
                    rows={recentRows}
                    emptyHint="No emails sent yet."
                    viewAllHref="/dashboard/email"
                />
            </div>
        </EntityListShell>
    );
}
