import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { ZoruCard } from '@/components/zoruui';
import { BookOpen } from 'lucide-react';

export default function KnowledgeBasePage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Knowledge Base"
        subtitle="Publish help articles for customers and your support agents."
        icon={BookOpen}
      />
      <ZoruCard className="p-12 text-center">
        <p className="text-[14px] text-zoru-ink-muted">
          The knowledge base is coming soon. You will be able to author articles, group
          them into categories and surface them to customers and agents inside tickets.
        </p>
      </ZoruCard>
    </div>
  );
}
