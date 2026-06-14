/**
 * X-ray a single model — auto-generated dashboard.
 */
import { notFound } from 'next/navigation';

import { getModelAction } from '@/app/actions/sabbi-models.actions';

import { XrayView } from './xray-view';

export const dynamic = 'force-dynamic';

export default async function XrayModelPage({ params }: { params: Promise<{ modelId: string }> }) {
  const { modelId } = await params;
  let model: Awaited<ReturnType<typeof getModelAction>> | null = null;
  try {
    model = await getModelAction(modelId);
  } catch {
    notFound();
  }
  if (!model) notFound();
  return <XrayView model={model} />;
}
