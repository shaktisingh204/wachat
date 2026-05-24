"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Rocket, ArrowRight, CircleCheck, CircleDashed } from "lucide-react";
import { Button, cn } from "@/components/zoruui";

const ONBOARDING_STEPS = [
  { key: "profile", label: "Tell us about you" },
  { key: "business", label: "Your business details" },
  { key: "requirements", label: "Choose your modules" },
  { key: "plan", label: "Pick a plan" },
] as const;

export function OnboardingBanner({
  status,
}: {
  status: "profile" | "business" | "requirements" | "plan" | "complete";
}) {
  const router = useRouter();
  const statusOrder = ["profile", "business", "requirements", "plan", "complete"];
  const currentIdx = statusOrder.indexOf(status);
  const completedCount = currentIdx;
  const totalSteps = ONBOARDING_STEPS.length;

  return (
    <div className="mt-6 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[15px] text-zoru-ink">Complete your setup</h3>
            <p className="mt-0.5 text-[13px] text-zoru-ink-muted">
              {completedCount} of {totalSteps} steps done — finish setting up to
              unlock your full workspace.
            </p>
          </div>
        </div>
        <Button onClick={() => router.push("/onboarding")}>
          Continue setup <ArrowRight />
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ONBOARDING_STEPS.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <div
              key={step.key}
              className={cn(
                "flex items-center gap-2 rounded-[var(--zoru-radius)] border px-3 py-2 text-[13px]",
                isDone && "border-zoru-line-strong bg-zoru-surface text-zoru-ink",
                isCurrent && "border-zoru-ink bg-zoru-surface-2 text-zoru-ink",
                !isDone && !isCurrent && "border-zoru-line text-zoru-ink-muted"
              )}
            >
              {isDone ? (
                <CircleCheck className="h-4 w-4 shrink-0 text-zoru-ink" />
              ) : (
                <CircleDashed
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isCurrent ? "text-zoru-ink" : "text-zoru-ink-subtle"
                  )}
                />
              )}
              {step.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
