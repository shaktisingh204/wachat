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
    <section className="space-y-6 motion-safe:animate-slide-up">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--st-text)]">{title}</h2>
        <div className="h-px flex-1 bg-gradient-to-r from-[var(--st-border)] to-transparent" />
      </div>
      <ScrollArea className="w-full pb-8 -mb-8">
        <div className="flex w-max space-x-6 pb-8 px-2 pt-2">
          {plans.map((plan: WithId<Plan>) => (
            <PlanCard
              key={plan._id.toString()}
              plan={plan}
              currentPlanId={currentPlanId}
              projectId={projectId}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="opacity-50 hover:opacity-100 transition-opacity" />
      </ScrollArea>
    </section>
  );
};
