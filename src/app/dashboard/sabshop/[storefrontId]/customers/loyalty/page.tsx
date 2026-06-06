"use client";

import React, { useState } from "react";
import { 
  Trophy, 
  Settings, 
  Gift, 
  CreditCard,
  Star,
  Check,
  Crown,
  Medal,
  Award,
  ChevronRight,
  TrendingUp,
  Percent
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardBody, CardFooter } from '@/components/sabcrm/20ui';
import { Button } from '@/components/sabcrm/20ui';
import { Badge } from '@/components/sabcrm/20ui';
import { Input } from '@/components/sabcrm/20ui';
import { Switch } from '@/components/sabcrm/20ui';

const mockTiers = [
  {
    id: "tier_bronze",
    name: "Bronze",
    icon: Medal,
    color: "text-orange-700",
    bgColor: "bg-orange-700/10",
    borderColor: "border-orange-700/20",
    requirements: "0 - 499 points",
    multiplier: "1.0x",
    benefits: ["Basic support", "Birthday reward ($5)", "Standard shipping"]
  },
  {
    id: "tier_silver",
    name: "Silver",
    icon: Award,
    color: "text-slate-400",
    bgColor: "bg-slate-400/10",
    borderColor: "border-slate-400/20",
    requirements: "500 - 1,999 points",
    multiplier: "1.25x",
    benefits: ["Priority support", "Birthday reward ($15)", "Free standard shipping", "Early access to sales"]
  },
  {
    id: "tier_gold",
    name: "Gold",
    icon: Crown,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    requirements: "2,000+ points",
    multiplier: "1.5x",
    benefits: ["24/7 VIP support", "Birthday reward ($50)", "Free express shipping", "Exclusive VIP events", "Dedicated account manager"]
  }
];

export default function LoyaltyProgramPage() {
  const [pointsEnabled, setPointsEnabled] = useState(true);
  const [vipEnabled, setVipEnabled] = useState(true);

  return (
    <div className="flex w-full flex-col gap-8 p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--st-text)] tracking-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            Loyalty & Rewards
          </h1>
          <p className="text-sm text-[var(--st-text-secondary)] mt-1">
            Configure your points system and manage VIP tiers to maximize customer retention.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Advanced Settings
          </Button>
          <Button className="flex items-center gap-2">
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Points Configuration */}
        <Card className="flex flex-col">
          <CardHeader className="border-b border-[var(--st-border)] pb-4 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-indigo-500" />
                Points System
              </CardTitle>
              <CardDescription>How customers earn and redeem points.</CardDescription>
            </div>
            <Switch checked={pointsEnabled} onCheckedChange={setPointsEnabled} />
          </CardHeader>
          <CardBody className="pt-6 flex-1 space-y-6">
            <div className={`space-y-4 ${!pointsEnabled ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm text-[var(--st-text)]">Earning Ratio</h4>
                  <p className="text-xs text-[var(--st-text-tertiary)] mt-0.5">Points earned per dollar spent</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--st-text-secondary)]">$1 = </span>
                  <Input defaultValue="1" className="w-20 text-center" />
                  <span className="text-sm text-[var(--st-text-secondary)]">pts</span>
                </div>
              </div>

              <div className="w-full h-px bg-[var(--st-border)]" />

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm text-[var(--st-text)]">Redemption Value</h4>
                  <p className="text-xs text-[var(--st-text-tertiary)] mt-0.5">Value of points at checkout</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input defaultValue="100" className="w-20 text-center" />
                  <span className="text-sm text-[var(--st-text-secondary)]">pts = </span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--st-text-secondary)] text-sm">$</span>
                    <Input defaultValue="1.00" className="w-24 pl-6 text-center" />
                  </div>
                </div>
              </div>

              <div className="w-full h-px bg-[var(--st-border)]" />

              <div>
                <h4 className="font-medium text-sm text-[var(--st-text)] mb-3">Bonus Earning Rules</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-[var(--st-bg-secondary)] p-3 rounded-[var(--st-radius)] border border-[var(--st-border)]">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-pink-500/10 rounded-md">
                        <Gift className="w-4 h-4 text-pink-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Account Creation</p>
                        <p className="text-xs text-[var(--st-text-tertiary)]">Reward for signing up</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input defaultValue="50" className="w-16 h-8 text-sm" />
                      <span className="text-xs text-[var(--st-text-secondary)]">pts</span>
                      <Switch defaultChecked />
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-[var(--st-bg-secondary)] p-3 rounded-[var(--st-radius)] border border-[var(--st-border)]">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-md">
                        <Star className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Leave a Review</p>
                        <p className="text-xs text-[var(--st-text-tertiary)]">Reward per product review</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input defaultValue="25" className="w-16 h-8 text-sm" />
                      <span className="text-xs text-[var(--st-text-secondary)]">pts</span>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
          <CardFooter className="bg-[var(--st-bg-secondary)] py-4 border-t border-[var(--st-border)] flex justify-between rounded-b-[var(--st-radius-lg)]">
             <span className="text-xs text-[var(--st-text-secondary)]">Last modified: 2 days ago</span>
             <Button variant="outline" size="sm">Manage Rules</Button>
          </CardFooter>
        </Card>

        {/* VIP Tiers Overview */}
        <Card className="flex flex-col">
          <CardHeader className="border-b border-[var(--st-border)] pb-4 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                VIP Tiers
              </CardTitle>
              <CardDescription>Exclusive benefits based on loyalty status.</CardDescription>
            </div>
            <Switch checked={vipEnabled} onCheckedChange={setVipEnabled} />
          </CardHeader>
          <CardBody className="pt-6 flex-1">
            <div className={`space-y-4 ${!vipEnabled ? "opacity-50 pointer-events-none" : ""}`}>
              {mockTiers.map((tier) => (
                <div key={tier.id} className={`p-4 rounded-[var(--st-radius-lg)] border ${tier.borderColor} bg-[var(--st-bg)] transition-shadow hover:shadow-[var(--st-shadow-md)] relative overflow-hidden group`}>
                  <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full ${tier.bgColor} -z-0 opacity-50 group-hover:opacity-100 transition-opacity`} />
                  
                  <div className="relative z-10 flex flex-col sm:flex-row gap-4 sm:items-start justify-between">
                    <div className="flex gap-4">
                      <div className={`mt-1 p-2 rounded-full ${tier.bgColor}`}>
                        <tier.icon className={`w-6 h-6 ${tier.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-base text-[var(--st-text)]">{tier.name}</h4>
                          <Badge variant="outline" className={`border-none ${tier.bgColor} ${tier.color}`}>
                            {tier.multiplier} Points
                          </Badge>
                        </div>
                        <p className="text-sm text-[var(--st-text-secondary)] font-medium mb-3">{tier.requirements}</p>
                        
                        <ul className="space-y-2">
                          {tier.benefits.map((benefit, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-[var(--st-text-tertiary)]">
                              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <Settings className="w-4 h-4 text-[var(--st-text-secondary)]" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
          <CardFooter className="bg-[var(--st-bg-secondary)] py-4 border-t border-[var(--st-border)] flex justify-center rounded-b-[var(--st-radius-lg)]">
            <Button variant="ghost" className="w-full text-indigo-500 hover:text-indigo-600">
              + Add New VIP Tier
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
