"use client";

import React, { useState } from 'react';
import { Calculator } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Label,
  Slider,
  SegmentedControl,
  StatCard,
} from '@/components/sabcrm/20ui';

type PlanKey = 'startup' | 'pro' | 'enterprise';

const plans: Record<PlanKey, { name: string; price: number; commissionRate: number }> = {
  startup: { name: 'Startup', price: 99, commissionRate: 0.2 },
  pro: { name: 'Pro', price: 299, commissionRate: 0.25 },
  enterprise: { name: 'Enterprise', price: 999, commissionRate: 0.3 },
};

const planItems = (Object.keys(plans) as PlanKey[]).map((key) => ({
  value: key,
  label: plans[key].name,
}));

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export function CommissionCalculator() {
  const [referrals, setReferrals] = useState(10);
  const [plan, setPlan] = useState<PlanKey>('pro');

  const selectedPlan = plans[plan];
  const monthlyRevenue = referrals * selectedPlan.price;
  const monthlyCommission = monthlyRevenue * selectedPlan.commissionRate;
  const annualCommission = monthlyCommission * 12;

  return (
    <div className="ui20 dark mt-12">
      <Card variant="outlined" padding="lg" className="space-y-8">
        <CardHeader className="flex items-center gap-3">
          <Calculator className="w-5 h-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
          <CardTitle>Live Commission Calculator</CardTitle>
        </CardHeader>

        <CardBody className="space-y-6">
          <div>
            <div className="flex justify-between mb-4">
              <Label htmlFor="commission-referrals">Monthly Referrals</Label>
              <span className="text-sm font-bold text-[var(--st-text)]">
                {referrals} accounts
              </span>
            </div>
            <Slider
              id="commission-referrals"
              value={referrals}
              min={1}
              max={100}
              step={1}
              ariaLabel="Monthly referrals"
              onValueChange={(val) => setReferrals(Array.isArray(val) ? val[0] : val)}
            />
          </div>

          <div>
            <Label className="block mb-4">Average Plan Size</Label>
            <SegmentedControl<PlanKey>
              items={planItems}
              value={plan}
              onChange={setPlan}
              fullWidth
              aria-label="Average plan size"
            />
          </div>
        </CardBody>

        <div className="pt-6 border-t border-[var(--st-border)] grid grid-cols-2 gap-6">
          <StatCard label="Monthly Earn" value={money(monthlyCommission)} />
          <StatCard
            label="Annual Earn"
            value={money(annualCommission)}
            delta={{ value: 'per year', tone: 'up' }}
          />
        </div>
      </Card>
    </div>
  );
}
