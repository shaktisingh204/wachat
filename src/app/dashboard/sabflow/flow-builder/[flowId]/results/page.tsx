import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, PageDescription, PageHeader, PageHeading, PageTitle } from '@/components/sabcrm/20ui/compat';
import {
  notFound } from "next/navigation";
import type { Metadata } from "next";

import { getSabFlow } from "@/app/actions/sabflow";
import { FlowResultsClient } from "@/components/sabflow/results/FlowResultsClient";

type Props = {
  params: Promise<{ flowId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { flowId } = await params;
  const flow = await getSabFlow(flowId);
  return {
    title: flow ? `${flow.name} — Results | SabFlow` : "Results | SabFlow",
  };
}

export default async function FlowResultsPage({ params }: Props) {
  const { flowId } = await params;
  const flow = await getSabFlow(flowId);

  if (!flow) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/sabflow/flow-builder">
              SabFlow
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink
              href={`/dashboard/sabflow/flow-builder/${flowId}`}
            >
              {flow.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Results</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>{flow.name}</PageTitle>
          <PageDescription>
            Submission results and analytics.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      {/* Composite — kept opaque, contains its own chrome. */}
      <FlowResultsClient flowId={flowId} />
    </div>
  );
}

export const dynamic = "force-dynamic";
