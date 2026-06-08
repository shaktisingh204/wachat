import { ScrollArea, ScrollBar } from '@/components/sabcrm/20ui';
import { PlanCard } from './plan-card';
import type { Plan, WithId } from '@/lib/definitions';

export const PlanCategorySection = ({
  title,
  plans,
  currentPlanId,
  projectId,
}: {
  title: string;
  plans: WithId<Plan>[];
  currentPlanId?: string;
  projectId?: string | null;
}) => {
  if (plans.length === 0) return null;
  return (
    <section className="flex flex-col gap-[var(--st-space-3)]">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold tracking-tight text-[var(--st-text)]">{title}</h3>
        <div className="h-px flex-1 bg-[var(--st-border)]" />
      </div>
      <ScrollArea className="w-full">
        <div className="flex w-max gap-[var(--st-space-4)] pb-3">
          {plans.map((plan: WithId<Plan>) => (
            <PlanCard
              key={plan._id.toString()}
              plan={plan}
              currentPlanId={currentPlanId}
              projectId={projectId}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
};
