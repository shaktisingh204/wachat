import React from "react";
import { getAccountHomeData } from "@/app/actions/home.actions";
import { getSession } from "@/app/actions/user.actions";
import { getOnboardingState } from "@/app/actions/onboarding-flow.actions";
import { DashboardContent } from "./_components/DashboardContent";

export const metadata = {
  title: "Home · SabNode"
};

export default async function HomePage() {
  const [data, session, obState] = await Promise.all([
    getAccountHomeData(),
    getSession(),
    getOnboardingState(),
  ]);

  const u = session?.user as any;
  const userName = u?.name || u?.email?.split("@")[0] || "there";

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <DashboardContent
        initialData={data}
        userName={userName}
        onboardingStatus={obState?.onboarding}
      />
    </div>
  );
}
