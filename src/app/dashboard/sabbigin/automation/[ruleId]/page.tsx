/**
 * SabBigin · Edit an existing automation rule.
 *
 * Loads the rule by id and reseeds the builder for editing. A missing /
 * unauthorised rule renders a teaching EmptyState rather than a blank page.
 */

import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  Card,
  EmptyState,
} from '@/components/sabcrm/20ui';

import { RuleBuilder } from '@/components/sabbigin/automation/rule-builder';
import { getSabbiginAutomation } from '@/app/actions/sabbigin-automations.actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ ruleId: string }>;
}

export default async function EditSabbiginAutomationPage({ params }: PageProps) {
  const { ruleId } = await params;
  const rule = await getSabbiginAutomation(ruleId);

  if (!rule) {
    return (
      <div className="20ui flex w-full flex-col gap-5">
        <PageHeader>
          <PageHeaderHeading>
            <PageEyebrow>SabBigin · Automation</PageEyebrow>
            <PageTitle>Rule not found</PageTitle>
          </PageHeaderHeading>
        </PageHeader>
        <Card padding="none" className="flex min-h-[320px] items-center justify-center">
          <EmptyState
            icon={FileQuestion}
            title="We couldn't open this rule"
            description="It may have been deleted, or it belongs to a different workspace."
            action={
              <Link
                href="/dashboard/sabbigin/automation"
                className="u-btn u-btn--primary u-btn--sm"
              >
                <span className="u-btn__label">Back to rules</span>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBigin · Automation</PageEyebrow>
          <PageTitle>{rule.name || 'Edit rule'}</PageTitle>
          <PageDescription>
            Adjust the trigger, conditions and actions, then save your changes.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <RuleBuilder initial={rule} />
    </div>
  );
}
