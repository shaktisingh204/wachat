/**
 * HR Notices — new notice page.
 *
 * Server component that renders the shared <NoticeForm /> with no
 * `initialData`, putting it in "create" mode. The form action redirects
 * to the detail page on success.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { NoticeForm } from '../_components/notice-form';

export const dynamic = 'force-dynamic';

export default function NewNoticePage() {
    return (
        <EntityListShell
            title="New Notice"
            subtitle="Draft a new advisory, circular, or company-wide notice."
        >
            <NoticeForm />
        </EntityListShell>
    );
}
