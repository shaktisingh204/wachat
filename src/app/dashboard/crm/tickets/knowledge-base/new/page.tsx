/**
 * New KB article — `/dashboard/crm/tickets/knowledge-base/new` (§1D.3).
 *
 * Sections: details · content · SEO · visibility/status. Handled by
 * shared `<KbArticleForm mode="create" />`.
 */

import { BookOpen } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { KbArticleForm } from '../_components/kb-article-form';

export const dynamic = 'force-dynamic';

export default function NewKbArticlePage() {
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <CrmPageHeader
                title="New Knowledge Base article"
                subtitle="Create a help article for customers or your support team."
                icon={BookOpen}
            />
            <KbArticleForm mode="create" />
        </div>
    );
}
