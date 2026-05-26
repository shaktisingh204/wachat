import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EmailClient } from './components/EmailClient';

export const dynamic = 'force-dynamic';

export default async function CrmEmailHubPage() {
    return (
        <EntityListShell
            title="Email"
            subtitle="Manage your inbox, email templates, and track analytics."
        >
            <EmailClient />
        </EntityListShell>
    );
}

