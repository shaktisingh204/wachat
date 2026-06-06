import React from 'react';
import {
  ZoruCard,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  ZoruCardFooter,
  ZoruSeparator,
} from '@/components/sabcrm/20ui/compat';
import { Check, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlanPurchaseButton } from '@/components/zoruui-domain/plan-purchase-button';
import { motion } from 'framer-motion';
import type { Plan, WithId } from '@/lib/definitions';

const PlanFeature = ({ children, included }: { children: React.ReactNode; included: boolean }) => (
  <li className="flex items-start gap-3">
    {included ? (
      <div className="mt-0.5 rounded-full bg-zoru-success/20 p-1">
        <Check className="h-3.5 w-3.5 text-zoru-success flex-shrink-0" />
      </div>
    ) : (
      <div className="mt-0.5 rounded-full bg-zoru-surface-3 p-1">
        <X className="h-3.5 w-3.5 text-zoru-ink-muted flex-shrink-0" />
      </div>
    )}
    <span className={cn('text-sm leading-snug', !included && 'text-zoru-ink-muted')}>
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
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="h-full"
    >
      <ZoruCard
        className={cn(
          'relative flex flex-col w-[340px] h-full overflow-hidden transition-all duration-300',
          isCurrentPlan
            ? 'border-2 border-zoru-primary shadow-glow-lg bg-zoru-bg'
            : 'border border-zoru-line hover:border-zoru-primary/50 hover:shadow-xl bg-zoru-bg'
        )}
      >
        {isCurrentPlan && (
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-zoru-primary to-zoru-info" />
        )}
        
        <ZoruCardHeader className="flex-grow pt-8 pb-4">
          <div className="flex justify-between items-start">
            <ZoruCardTitle className="text-xl font-bold">{plan.name}</ZoruCardTitle>
            {isCurrentPlan && (
              <span className="inline-flex items-center gap-1 rounded-full bg-zoru-primary/10 px-2.5 py-0.5 text-xs font-semibold text-zoru-primary">
                <Sparkles className="h-3 w-3" /> Current
              </span>
            )}
          </div>
          <div className="mt-4 flex items-baseline text-5xl font-extrabold tracking-tight text-zoru-ink">
            <span className="text-2xl font-medium text-zoru-ink-muted mr-1">{plan.currency === 'INR' ? '₹' : plan.currency}</span>
            {plan.price}
            <span className="ml-1 text-sm font-medium text-zoru-ink-muted">/mo</span>
          </div>
          <ZoruCardDescription className="mt-4 text-[11px] uppercase tracking-wider font-semibold text-zoru-info-ink">
            + Mkt: ₹{plan.messageCosts?.marketing ?? 'N/A'} • Util: ₹{plan.messageCosts?.utility ?? 'N/A'} • Auth: ₹{plan.messageCosts?.authentication ?? 'N/A'}
          </ZoruCardDescription>
        </ZoruCardHeader>

        <ZoruSeparator className="opacity-60 mx-6 w-auto" />

        <ZoruCardContent className="pt-6 pb-6 flex-grow space-y-4">
          <ul className="space-y-4">
            <PlanFeature included={true}>
              {plan.projectLimit > 0 ? <><strong className="text-zoru-ink">{plan.projectLimit}</strong> Project(s)</> : <strong className="text-zoru-ink">Unlimited</strong>}{' '} Projects
            </PlanFeature>
            <PlanFeature included={true}>
              {plan.agentLimit > 0 ? <><strong className="text-zoru-ink">{plan.agentLimit}</strong> Agent(s) per Project</> : <strong className="text-zoru-ink">Unlimited</strong>}{' '} Agents
            </PlanFeature>
            <PlanFeature included={true}>
              {plan.templateLimit > 0 ? <><strong className="text-zoru-ink">{plan.templateLimit}</strong> Templates</> : <strong className="text-zoru-ink">Unlimited</strong>}{' '} Templates
            </PlanFeature>
            <PlanFeature included={true}>
              {plan.flowLimit > 0 ? <><strong className="text-zoru-ink">{plan.flowLimit}</strong> Flows</> : <strong className="text-zoru-ink">Unlimited</strong>}{' '} Flows
            </PlanFeature>
            <PlanFeature included={plan.features.apiAccess}>
              API Access included
            </PlanFeature>
          </ul>
        </ZoruCardContent>

        <ZoruCardFooter className="mt-auto pt-4 pb-6">
          <div className="w-full">
            <PlanPurchaseButton plan={plan} currentPlanId={currentPlanId} projectId={projectId} />
          </div>
        </ZoruCardFooter>
      </ZoruCard>
    </motion.div>
  );
};
