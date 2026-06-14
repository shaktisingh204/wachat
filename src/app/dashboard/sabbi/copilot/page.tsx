/**
 * Copilot — ask a question in plain English; the AI builds a governed
 * MetricQuery against a model (never raw text-to-SQL) and renders the answer.
 */
import { listModelsAction } from '@/app/actions/sabbi-models.actions';

import { CopilotChat } from './copilot-chat';

export const dynamic = 'force-dynamic';

export default async function CopilotPage() {
  let models: Awaited<ReturnType<typeof listModelsAction>>['items'] = [];
  try {
    models = (await listModelsAction({ limit: 200 })).items;
  } catch {
    models = [];
  }
  return <CopilotChat models={models} />;
}
