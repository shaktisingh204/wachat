import React from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Separator,
  Badge,
} from '@/components/sabcrm/20ui';
import { Check, X, Sparkles, Flame, Package, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlanPurchaseButton } from '@/components/20ui-domain/plan-purchase-button';
import type { Plan, WithId } from '@/lib/definitions';

const PlanFeature = ({ children, included }: { children: React.ReactNode; included: boolean }) => (
  <li className="flex items-start gap-2">
    {included ? (
      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--st-status-ok)]" aria-hidden="true" />
    ) : (
      <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--st-text-tertiary)]" aria-hidden="true" />
    )}
    <span className={cn('text-sm leading-snug text-[var(--st-text-secondary)]', !included && 'text-[var(--st-text-tertiary)]')}>
      {children}
    </span>
  </li>
);

export const PlanCard = ({
  plan,
  currentPlanId,
  projectId,
  popular = false,
}: {
  plan: WithId<Plan>;
  currentPlanId?: string;
  projectId?: string | null;
  /** Highlight this card as the recommended pick (when it isn't the current plan). */
  popular?: boolean;
}) => {
  const isCurrentPlan = currentPlanId?.toString() === plan._id.toString();
  const isHighlighted = isCurrentPlan || popular;
  const showPopular = popular && !isCurrentPlan;

  return (
    <Card
      padding="none"
      className={cn(
        'relative flex h-full w-[296px] max-w-[calc(100vw-3rem)] flex-shrink-0 snap-start flex-col overflow-hidden transition-[border-color,box-shadow] duration-200',
        isHighlighted
          ? 'border-[var(--st-accent)] shadow-[var(--st-shadow-md)] bg-[var(--st-accent-soft)]/40'
          : 'border-[var(--st-border)] hover:border-[var(--st-border-strong)] hover:shadow-[var(--st-shadow-md)]',
      )}
    >
      {isHighlighted && (
        <span className="absolute inset-x-0 top-0 h-[3px] bg-[var(--st-accent)]" aria-hidden="true" />
      )}

      <CardHeader className="px-5 pb-3 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
              aria-hidden="true"
            >
              <Package className="h-4 w-4" />
            </span>
            <h4 className="text-base font-semibold tracking-tight text-[var(--st-text)]">{plan.name}</h4>
          </div>
          {isCurrentPlan ? (
            <Badge tone="accent">
              <Sparkles className="h-3 w-3" aria-hidden="true" /> Current
            </Badge>
          ) : showPopular ? (
            <Badge tone="accent" kind="solid">
              <Flame className="h-3 w-3" aria-hidden="true" /> Popular
            </Badge>
          ) : null}
        </div>

        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-lg font-medium text-[var(--st-text-secondary)]">
            {plan.currency === 'INR' ? '₹' : plan.currency}
          </span>
          <span className="text-3xl font-bold tracking-tight text-[var(--st-text)]">{plan.price}</span>
          <span className="text-xs font-medium text-[var(--st-text-tertiary)]">/mo</span>
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-[var(--st-text-tertiary)]">
          <MessageSquare className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          <span className="tabular-nums">
            Mkt ₹{plan.messageCosts?.marketing ?? 'N/A'} · Util ₹{plan.messageCosts?.utility ?? 'N/A'} · Auth ₹
            {plan.messageCosts?.authentication ?? 'N/A'}
          </span>
        </div>
      </CardHeader>

      <Separator className="mx-5 w-auto opacity-60" />

      <CardBody className="flex-1 px-5 py-4">
        <ul className="space-y-2.5">
          <PlanFeature included>
            {plan.projectLimit > 0 ? (
              <>
                <strong className="text-[var(--st-text)]">{plan.projectLimit}</strong> project
                {plan.projectLimit === 1 ? '' : 's'}
              </>
            ) : (
              <>
                <strong className="text-[var(--st-text)]">Unlimited</strong> projects
              </>
            )}
          </PlanFeature>
          <PlanFeature included>
            {plan.agentLimit > 0 ? (
              <>
                <strong className="text-[var(--st-text)]">{plan.agentLimit}</strong> agent
                {plan.agentLimit === 1 ? '' : 's'} per project
              </>
            ) : (
              <>
                <strong className="text-[var(--st-text)]">Unlimited</strong> agents per project
              </>
            )}
          </PlanFeature>
          <PlanFeature included>
            {plan.templateLimit > 0 ? (
              <>
                <strong className="text-[var(--st-text)]">{plan.templateLimit}</strong> templates
              </>
            ) : (
              <>
                <strong className="text-[var(--st-text)]">Unlimited</strong> templates
              </>
            )}
          </PlanFeature>
          <PlanFeature included>
            {plan.flowLimit > 0 ? (
              <>
                <strong className="text-[var(--st-text)]">{plan.flowLimit}</strong> flows
              </>
            ) : (
              <>
                <strong className="text-[var(--st-text)]">Unlimited</strong> flows
              </>
            )}
          </PlanFeature>
          <PlanFeature included={!!plan.features?.apiAccess}>API access</PlanFeature>
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
