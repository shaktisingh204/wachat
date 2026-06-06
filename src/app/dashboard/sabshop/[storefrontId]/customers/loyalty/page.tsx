"use client";

import React, { useState } from "react";
import {
  Trophy,
  Settings,
  Gift,
  Star,
  Check,
  Crown,
  Medal,
  Award,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  Button,
  IconButton,
  Badge,
  Field,
  Input,
  Switch,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
} from "@/components/sabcrm/20ui";

const mockTiers = [
  {
    id: "tier_bronze",
    name: "Bronze",
    icon: Medal,
    requirements: "0 - 499 points",
    multiplier: "1.0x",
    benefits: ["Basic support", "Birthday reward ($5)", "Standard shipping"],
  },
  {
    id: "tier_silver",
    name: "Silver",
    icon: Award,
    requirements: "500 - 1,999 points",
    multiplier: "1.25x",
    benefits: [
      "Priority support",
      "Birthday reward ($15)",
      "Free standard shipping",
      "Early access to sales",
    ],
  },
  {
    id: "tier_gold",
    name: "Gold",
    icon: Crown,
    requirements: "2,000+ points",
    multiplier: "1.5x",
    benefits: [
      "24/7 VIP support",
      "Birthday reward ($50)",
      "Free express shipping",
      "Exclusive VIP events",
      "Dedicated account manager",
    ],
  },
];

export default function LoyaltyProgramPage() {
  const [pointsEnabled, setPointsEnabled] = useState(true);
  const [vipEnabled, setVipEnabled] = useState(true);

  return (
    <div className="flex w-full flex-col gap-8 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-[var(--st-accent)]" aria-hidden="true" />
            Loyalty &amp; Rewards
          </PageTitle>
          <PageDescription>
            Configure your points system and manage VIP tiers to maximize customer
            retention.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="outline" iconLeft={Settings}>
            Advanced Settings
          </Button>
          <Button variant="primary">Save Changes</Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Points Configuration */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" />
                Points System
              </CardTitle>
              <CardDescription>How customers earn and redeem points.</CardDescription>
            </div>
            <Switch
              checked={pointsEnabled}
              onCheckedChange={setPointsEnabled}
              aria-label="Enable points system"
            />
          </CardHeader>
          <CardBody className="flex-1 space-y-6">
            <div
              className={`space-y-4 ${
                !pointsEnabled ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-medium text-sm text-[var(--st-text)]">
                    Earning Ratio
                  </h4>
                  <p className="text-xs text-[var(--st-text-tertiary)] mt-0.5">
                    Points earned per dollar spent
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--st-text-secondary)]">$1 =</span>
                  <Field className="w-20" label="Points per dollar">
                    <Input
                      defaultValue="1"
                      inputSize="sm"
                      className="text-center"
                      aria-label="Points earned per dollar"
                    />
                  </Field>
                  <span className="text-sm text-[var(--st-text-secondary)]">pts</span>
                </div>
              </div>

              <div className="w-full h-px bg-[var(--st-border)]" />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-medium text-sm text-[var(--st-text)]">
                    Redemption Value
                  </h4>
                  <p className="text-xs text-[var(--st-text-tertiary)] mt-0.5">
                    Value of points at checkout
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Field className="w-20" label="Points to redeem">
                    <Input
                      defaultValue="100"
                      inputSize="sm"
                      className="text-center"
                      aria-label="Points required to redeem"
                    />
                  </Field>
                  <span className="text-sm text-[var(--st-text-secondary)]">pts =</span>
                  <Field className="w-24" label="Redemption value">
                    <Input
                      defaultValue="1.00"
                      inputSize="sm"
                      prefix="$"
                      className="text-center"
                      aria-label="Redemption value in dollars"
                    />
                  </Field>
                </div>
              </div>

              <div className="w-full h-px bg-[var(--st-border)]" />

              <div>
                <h4 className="font-medium text-sm text-[var(--st-text)] mb-3">
                  Bonus Earning Rules
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 bg-[var(--st-bg-secondary)] p-3 rounded-[var(--st-radius)] border border-[var(--st-border)]">
                    <div className="flex items-center gap-3">
                      <span className="p-2 rounded-[var(--st-radius)] bg-[var(--st-accent-soft)]">
                        <Gift className="w-4 h-4 text-[var(--st-accent)]" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-[var(--st-text)]">
                          Account Creation
                        </p>
                        <p className="text-xs text-[var(--st-text-tertiary)]">
                          Reward for signing up
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Field className="w-16" label="Account creation points">
                        <Input
                          defaultValue="50"
                          inputSize="sm"
                          aria-label="Points for account creation"
                        />
                      </Field>
                      <span className="text-xs text-[var(--st-text-secondary)]">pts</span>
                      <Switch defaultChecked aria-label="Enable account creation reward" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 bg-[var(--st-bg-secondary)] p-3 rounded-[var(--st-radius)] border border-[var(--st-border)]">
                    <div className="flex items-center gap-3">
                      <span className="p-2 rounded-[var(--st-radius)] bg-[var(--st-accent-soft)]">
                        <Star className="w-4 h-4 text-[var(--st-accent)]" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-[var(--st-text)]">
                          Leave a Review
                        </p>
                        <p className="text-xs text-[var(--st-text-tertiary)]">
                          Reward per product review
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Field className="w-16" label="Review reward points">
                        <Input
                          defaultValue="25"
                          inputSize="sm"
                          aria-label="Points for leaving a review"
                        />
                      </Field>
                      <span className="text-xs text-[var(--st-text-secondary)]">pts</span>
                      <Switch defaultChecked aria-label="Enable review reward" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
          <CardFooter className="flex justify-between items-center">
            <span className="text-xs text-[var(--st-text-secondary)]">
              Last modified: 2 days ago
            </span>
            <Button variant="outline" size="sm">
              Manage Rules
            </Button>
          </CardFooter>
        </Card>

        {/* VIP Tiers Overview */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" />
                VIP Tiers
              </CardTitle>
              <CardDescription>Exclusive benefits based on loyalty status.</CardDescription>
            </div>
            <Switch
              checked={vipEnabled}
              onCheckedChange={setVipEnabled}
              aria-label="Enable VIP tiers"
            />
          </CardHeader>
          <CardBody className="flex-1">
            <div
              className={`space-y-4 ${
                !vipEnabled ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              {mockTiers.map((tier) => {
                const TierIcon = tier.icon;
                return (
                  <div
                    key={tier.id}
                    className="p-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] transition-shadow hover:shadow-[var(--st-shadow-md)]"
                  >
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-start justify-between">
                      <div className="flex gap-4">
                        <span className="mt-1 p-2 rounded-full bg-[var(--st-accent-soft)]">
                          <TierIcon className="w-6 h-6 text-[var(--st-accent)]" aria-hidden="true" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-base text-[var(--st-text)]">
                              {tier.name}
                            </h4>
                            <Badge tone="accent">{tier.multiplier} Points</Badge>
                          </div>
                          <p className="text-sm text-[var(--st-text-secondary)] font-medium mb-3">
                            {tier.requirements}
                          </p>

                          <ul className="space-y-2">
                            {tier.benefits.map((benefit) => (
                              <li
                                key={benefit}
                                className="flex items-start gap-2 text-sm text-[var(--st-text-tertiary)]"
                              >
                                <Check
                                  className="w-4 h-4 text-[var(--st-status-ok)] shrink-0 mt-0.5"
                                  aria-hidden="true"
                                />
                                <span>{benefit}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <IconButton
                        icon={Settings}
                        label={`Configure ${tier.name} tier`}
                        variant="ghost"
                        className="shrink-0"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
          <CardFooter className="flex justify-center">
            <Button variant="ghost" block>
              + Add New VIP Tier
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
