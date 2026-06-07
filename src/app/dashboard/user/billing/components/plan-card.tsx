import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  Separator,
  Badge,
} from '@/components/sabcrm/20ui';
import { Check, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlanPurchaseButton } from '@/components/20ui-domain/plan-purchase-button';
import type { Plan, WithId } from '@/lib/definitions';

const PlanFeature = ({ children, included }: { children: React.ReactNode; included: boolean }) => (
  <li className="flex items-start gap-3">
    {included ? (
      <span className="mt-0.5 rounded-[var(--st-radius-pill)] bg-[var(--st-status-ok)]/20 p-1" aria-hidden="true">
        <Check className="h-3.5 w-3.5 flex-shrink-0 text-[var(--st-status-ok)]" />
      </span>
    ) : (
      <span className="mt-0.5 rounded-[var(--st-radius-pill)] bg-[var(--st-bg-muted)] p-1" aria-hidden="true">
        <X className="h-3.5 w-3.5 flex-shrink-0 text-[var(--st-text-secondary)]" />
      </span>
    )}
    <span className={cn('text-sm leading-snug', !included && 'text-[var(--st-text-secondary)]')}>
      {children}
    </span>
  </li>
);

export const PlanCard = ({
  plan,
  currentPlanId,
  projectId,
}: {
  plan: WithId<Plan>;
  currentPlanId?: string;
  projectId?: string | null;
}) => {
  const isCurrentPlan = currentPlanId?.toString() === plan._id.toString();

  return (
    <div className="h-full transition-transform duration-200 ease-out motion-safe:hover:-translate-y-2">
      <Card
        padding="none"
        className={cn(
          'relative flex h-full w-[340px] flex-col overflow-hidden',
          isCurrentPlan
            ? 'border-2 border-[var(--st-text)] shadow-[var(--st-shadow-lg)]'
            : 'border-[var(--st-border)] transition-shadow duration-200 hover:border-[var(--st-text)]/50 hover:shadow-[var(--st-shadow-lg)]'
        )}
      >
        {isCurrentPlan && (
          <span
            className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--st-text)] to-[var(--st-text-secondary)]"
            aria-hidden="true"
          />
        )}

        <CardHeader className="flex-grow px-6 pt-8 pb-4">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
            {isCurrentPlan && (
              <Badge tone="accent">
                <Sparkles className="h-3 w-3" aria-hidden="true" /> Current
              </Badge>
            )}
          </div>
          <div className="mt-4 flex items-baseline text-5xl font-extrabold tracking-tight text-[var(--st-text)]">
            <span className="mr-1 text-2xl font-medium text-[var(--st-text-secondary)]">
              {plan.currency === 'INR' ? '₹' : plan.currency}
            </span>
            {plan.price}
            <span className="ml-1 text-sm font-medium text-[var(--st-text-secondary)]">/mo</span>
          </div>
          <CardDescription className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">
            + Mkt: ₹{plan.messageCosts?.marketing ?? 'N/A'}, Util: ₹{plan.messageCosts?.utility ?? 'N/A'}, Auth: ₹{plan.messageCosts?.authentication ?? 'N/A'}
          </CardDescription>
        </CardHeader>

        <Separator className="mx-6 w-auto opacity-60" />

        <CardBody className="flex-grow space-y-4 px-6 pt-6 pb-6">
          <ul className="space-y-4">
            <PlanFeature included={true}>
              {plan.projectLimit > 0 ? <><strong className="text-[var(--st-text)]">{plan.projectLimit}</strong> Project(s)</> : <strong className="text-[var(--st-text)]">Unlimited</strong>}{' '} Projects
            </PlanFeature>
            <PlanFeature included={true}>
              {plan.agentLimit > 0 ? <><strong className="text-[var(--st-text)]">{plan.agentLimit}</strong> Agent(s) per Project</> : <strong className="text-[var(--st-text)]">Unlimited</strong>}{' '} Agents
            </PlanFeature>
            <PlanFeature included={true}>
              {plan.templateLimit > 0 ? <><strong className="text-[var(--st-text)]">{plan.templateLimit}</strong> Templates</> : <strong className="text-[var(--st-text)]">Unlimited</strong>}{' '} Templates
            </PlanFeature>
            <PlanFeature included={true}>
              {plan.flowLimit > 0 ? <><strong className="text-[var(--st-text)]">{plan.flowLimit}</strong> Flows</> : <strong className="text-[var(--st-text)]">Unlimited</strong>}{' '} Flows
            </PlanFeature>
            <PlanFeature included={plan.features.apiAccess}>
              API Access included
            </PlanFeature>
          </ul>
        </CardBody>

        <CardFooter className="mt-auto px-6 pt-4 pb-6">
          <div className="w-full">
            <PlanPurchaseButton plan={plan} currentPlanId={currentPlanId} projectId={projectId} />
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
