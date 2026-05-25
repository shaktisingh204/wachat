import React from 'react';
import { motion } from 'framer-motion';
import { ZoruScrollArea, ZoruScrollBar } from '@/components/zoruui';
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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-zoru-ink">{title}</h2>
        <div className="h-px flex-1 bg-gradient-to-r from-zoru-line to-transparent" />
      </div>
      <ZoruScrollArea className="w-full pb-8 -mb-8">
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
        <ZoruScrollBar orientation="horizontal" className="opacity-50 hover:opacity-100 transition-opacity" />
      </ZoruScrollArea>
    </motion.div>
  );
};
