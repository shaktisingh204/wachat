/**
 * New KB article — `/dashboard/crm/tickets/knowledge-base/new` (§1D.3).
 *
 * Sections: details · content · SEO · visibility/status. Handled by
 * shared `<KbArticleForm mode="create" />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { KbArticleForm } from '../_components/kb-article-form';

export const dynamic = 'force-dynamic';

export default function NewKbArticlePage() {
    return (
        <EntityDetailShell
            eyebrow="KNOWLEDGE BASE"
            title="New Knowledge Base article"
            back={{ href: '/dashboard/crm/tickets/knowledge-base', label: 'Knowledge Base' }}
        >
            <KbArticleForm mode="create" />
        </EntityDetailShell>
    );
}
