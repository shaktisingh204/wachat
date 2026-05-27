"use client";

import React, { useState } from 'react';
import { Calculator } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

export function CommissionCalculator() {
  const [referrals, setReferrals] = useState(10);
  const [plan, setPlan] = useState<'startup' | 'pro' | 'enterprise'>('pro');

  const plans = {
    startup: { name: 'Startup', price: 99, commissionRate: 0.20 },
    pro: { name: 'Pro', price: 299, commissionRate: 0.25 },
    enterprise: { name: 'Enterprise', price: 999, commissionRate: 0.30 }
  };

  const selectedPlan = plans[plan];
  const monthlyRevenue = referrals * selectedPlan.price;
  const monthlyCommission = monthlyRevenue * selectedPlan.commissionRate;
  const annualCommission = monthlyCommission * 12;

  return (
    <div className="bg-[#050505] border border-white/10 rounded-lg p-6 space-y-8 mt-12">
      <div className="flex items-center gap-3 mb-6">
        <Calculator className="w-5 h-5 text-white/70" />
        <h3 className="font-bold text-lg">Live Commission Calculator</h3>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex justify-between mb-4">
            <label className="text-sm text-white/70 font-sans">Monthly Referrals</label>
            <span className="text-sm font-bold">{referrals} accounts</span>
          </div>
          <Slider
            defaultValue={[referrals]}
            max={100}
            min={1}
            step={1}
            onValueChange={(vals) => setReferrals(vals[0])}
            className="w-full"
          />
        </div>

        <div>
          <label className="text-sm text-white/70 font-sans block mb-4">Average Plan Size</label>
          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(plans) as Array<keyof typeof plans>).map((p) => (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className={`py-2 px-3 text-sm rounded border transition-colors ${
                  plan === p 
                    ? 'border-white bg-white/10 text-white' 
                    : 'border-white/10 text-white/50 hover:border-white/30'
                }`}
              >
                {plans[p].name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-white/10 grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-white/50 uppercase tracking-widest mb-1">Monthly Earn</p>
          <p className="text-3xl font-bold">${monthlyCommission.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>
        <div>
          <p className="text-xs text-white/50 uppercase tracking-widest mb-1">Annual Earn</p>
          <p className="text-3xl font-bold text-green-400">${annualCommission.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>
      </div>
    </div>
  );
}
