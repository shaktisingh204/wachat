import { EmailSuiteLayout } from '@/components/email/layout';
import { TemplatesClient } from '@/components/email/templates/templates-client';

export default function EmailTemplatesPage() {
    return (
        <EmailSuiteLayout>
            <TemplatesClient />
        </EmailSuiteLayout>
    );
}
