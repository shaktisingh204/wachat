import { ScrollArea, ScrollBar, Badge } from '@/components/sabcrm/20ui';
import { PlanCard } from './plan-card';
import type { LucideIcon } from 'lucide-react';
import type { Plan, WithId } from '@/lib/definitions';

export const PlanCategorySection = ({
  title,
  icon: Icon,
  plans,
  currentPlanId,
  popularPlanId,
  projectId,
}: {
  title: string;
  icon?: LucideIcon;
  plans: WithId<Plan>[];
  currentPlanId?: string;
  popularPlanId?: string;
  projectId?: string | null;
}) => {
  if (plans.length === 0) return null;
  return (
    <section className="flex flex-col gap-[var(--st-space-3)]">
      <div className="flex items-center gap-2.5">
        {Icon ? (
          <span
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
            aria-hidden="true"
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null}
        <h3 className="text-sm font-semibold tracking-tight text-[var(--st-text)]">{title}</h3>
        <Badge tone="neutral" kind="soft" className="tabular-nums">
          {plans.length}
        </Badge>
        <div className="h-px flex-1 bg-[var(--st-border)]" />
      </div>
      <ScrollArea className="w-full" viewportClassName="snap-x snap-mandatory">
        <div className="flex w-max gap-[var(--st-space-4)] pb-3">
          {plans.map((plan: WithId<Plan>) => (
            <PlanCard
              key={plan._id.toString()}
              plan={plan}
              currentPlanId={currentPlanId}
              popular={popularPlanId === plan._id.toString()}
              projectId={projectId}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
};
