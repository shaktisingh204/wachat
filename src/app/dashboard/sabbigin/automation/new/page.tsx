/**
 * SabBigin · Create a new automation rule.
 */

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';

import { RuleBuilder } from '@/components/sabbigin/automation/rule-builder';

export const dynamic = 'force-dynamic';

export default function NewSabbiginAutomationPage() {
  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBigin · Automation</PageEyebrow>
          <PageTitle>New rule</PageTitle>
          <PageDescription>
            Set a trigger, optionally narrow it with conditions, then list the
            actions to run.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <RuleBuilder />
    </div>
  );
}
