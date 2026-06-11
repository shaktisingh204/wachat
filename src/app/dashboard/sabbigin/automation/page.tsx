/**
 * SabBigin · Automation rules list.
 *
 * Lists tenant automations from `crm_automations` with an inline enabled
 * toggle, a "New rule" CTA, a teaching EmptyState, and a card linking out to
 * SabFlow for branching/looping flows.
 */

import Link from 'next/link';
import { Workflow, Plus, GitBranch, ArrowUpRight } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  Card,
  CardBody,
  EmptyState,
  Badge,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';

import { listSabbiginAutomations } from '@/app/actions/sabbigin-automations.actions';
import { relativeTime } from '@/components/sabbigin/lib/format';
import { AutomationToggle } from '@/components/sabbigin/automation/automation-toggle';

export const dynamic = 'force-dynamic';

export default async function SabbiginAutomationPage() {
  const rules = await listSabbiginAutomations();

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBigin · Automation</PageEyebrow>
          <PageTitle>Workflow rules</PageTitle>
          <PageDescription>
            Run a sequence of actions automatically when something happens in your
            pipeline — no limits on how many rules you create.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Link
            href="/dashboard/sabbigin/automation/new"
            className="u-btn u-btn--primary u-btn--sm"
          >
            <Plus size={13} aria-hidden="true" />
            <span className="u-btn__label">New rule</span>
          </Link>
        </PageActions>
      </PageHeader>

      {/* SabFlow upsell */}
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-md"
              style={{ background: 'var(--u-surface-2, #f3f4f6)' }}
            >
              <GitBranch size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium">Need branching, loops or delays?</p>
              <p className="text-sm" style={{ color: 'var(--u-text-muted, #6b7280)' }}>
                Build advanced multi-step flows on the visual canvas in SabFlow.
              </p>
            </div>
          </div>
          <Link href="/dashboard/sabflow" className="u-btn u-btn--secondary u-btn--sm">
            <span className="u-btn__label">Open in SabFlow</span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </Link>
        </CardBody>
      </Card>

      {rules.length === 0 ? (
        <Card padding="none" className="flex min-h-[320px] items-center justify-center">
          <EmptyState
            icon={Workflow}
            title="No automation rules yet"
            description="Automations watch your pipeline and act for you — assign owners, create follow-up tasks, send emails or call a webhook the moment a deal, lead or contact changes. Create your first rule to put your busywork on autopilot."
            action={
              <Link
                href="/dashboard/sabbigin/automation/new"
                className="u-btn u-btn--primary u-btn--sm"
              >
                <Plus size={13} aria-hidden="true" />
                <span className="u-btn__label">Create your first rule</span>
              </Link>
            }
          />
        </Card>
      ) : (
        <Card padding="none">
          <Table>
            <THead>
              <Tr>
                <Th>Rule</Th>
                <Th>Trigger</Th>
                <Th>Actions</Th>
                <Th>Last run</Th>
                <Th align="right">Enabled</Th>
              </Tr>
            </THead>
            <TBody>
              {rules.map((rule) => (
                <Tr key={rule.id}>
                  <Td>
                    <Link
                      href={`/dashboard/sabbigin/automation/${rule.id}`}
                      className="font-medium hover:underline"
                    >
                      {rule.name}
                    </Link>
                    {rule.description ? (
                      <p
                        className="text-sm"
                        style={{ color: 'var(--u-text-muted, #6b7280)' }}
                      >
                        {rule.description}
                      </p>
                    ) : null}
                  </Td>
                  <Td>
                    <span className="text-sm">{rule.triggerSummary}</span>
                    {rule.conditionCount > 0 ? (
                      <Badge tone="neutral" style={{ marginLeft: 6 }}>
                        {rule.conditionCount} condition
                        {rule.conditionCount === 1 ? '' : 's'}
                      </Badge>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge tone="info">
                      {rule.actionCount} action{rule.actionCount === 1 ? '' : 's'}
                    </Badge>
                  </Td>
                  <Td>
                    <span
                      className="text-sm"
                      style={{ color: 'var(--u-text-muted, #6b7280)' }}
                    >
                      {rule.lastRunAt ? relativeTime(rule.lastRunAt) : 'Never'}
                    </span>
                  </Td>
                  <Td align="right">
                    <AutomationToggle id={rule.id} enabled={rule.enabled} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
