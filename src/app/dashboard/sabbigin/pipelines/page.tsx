import { getCrmPipelines, getCrmPipelineKpis } from '@/app/actions/crm-pipelines.actions';
import { PipelinesClient } from './_components/pipelines-client';

export const dynamic = 'force-dynamic';

export default async function SalesPipelinePage() {
  const [pipelines, kpi] = await Promise.all([
    getCrmPipelines(),
    getCrmPipelineKpis(),
  ]);

  return <PipelinesClient pipelines={pipelines} kpi={kpi} />;
}
