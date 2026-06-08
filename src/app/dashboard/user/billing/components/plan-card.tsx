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
  <li className="flex items-center gap-2">
    {included ? (
      <Check className="h-4 w-4 flex-shrink-0 text-[var(--st-status-ok)]" aria-hidden="true" />
    ) : (
      <X className="h-4 w-4 flex-shrink-0 text-[var(--st-text-tertiary)]" aria-hidden="true" />
    )}
    <span className={cn('text-sm leading-snug', !included && 'text-[var(--st-text-tertiary)]')}>
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
    <Card
      padding="none"
      className={cn(
        'relative flex h-full w-[300px] flex-col overflow-hidden transition-shadow duration-200',
        isCurrentPlan
          ? 'border-2 border-[var(--st-accent)] shadow-[var(--st-shadow-md)]'
          : 'border-[var(--st-border)] hover:border-[var(--st-border-strong)] hover:shadow-[var(--st-shadow-md)]',
      )}
    >
      {isCurrentPlan && (
        <span
          className="absolute inset-x-0 top-0 h-1 bg-[var(--st-accent)]"
          aria-hidden="true"
        />
      )}

      <CardHeader className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold">{plan.name}</CardTitle>
          {isCurrentPlan && (
            <Badge tone="accent">
              <Sparkles className="h-3 w-3" aria-hidden="true" /> Current
            </Badge>
          )}
        </div>
        <div className="mt-3 flex items-baseline gap-1 text-3xl font-bold tracking-tight text-[var(--st-text)]">
          <span className="text-lg font-medium text-[var(--st-text-secondary)]">
            {plan.currency === 'INR' ? '₹' : plan.currency}
          </span>
          {plan.price}
          <span className="text-xs font-medium text-[var(--st-text-secondary)]">/mo</span>
        </div>
        <CardDescription className="mt-2 text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
          Mkt ₹{plan.messageCosts?.marketing ?? 'N/A'} · Util ₹{plan.messageCosts?.utility ?? 'N/A'} · Auth ₹{plan.messageCosts?.authentication ?? 'N/A'}
        </CardDescription>
      </CardHeader>

      <Separator className="mx-5 w-auto opacity-60" />

      <CardBody className="flex-1 px-5 py-4">
        <ul className="space-y-2.5">
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

      <CardFooter className="mt-auto px-5 pb-5 pt-3">
        <div className="w-full">
          <PlanPurchaseButton plan={plan} currentPlanId={currentPlanId} projectId={projectId} />
        </div>
      </CardFooter>
    </Card>
  );
};
