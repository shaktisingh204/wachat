'use server';

import { hrList, hrSave, hrDelete } from '@/lib/hr-crud';
import { OrgChartNode, OrgChartNodeSchema } from '@/lib/hrm-advanced-types';
import { revalidatePath } from 'next/cache';

const COLLECTION = 'hrm_org_chart_nodes';

export async function getOrgChartNodes() {
  return await hrList<OrgChartNode>(COLLECTION);
}

export async function saveOrgChartNode(payload: Partial<OrgChartNode>) {
  const parsed = OrgChartNodeSchema.parse(payload);
  const result = await hrSave(COLLECTION, parsed);
  if (result.error) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/org-chart');
  return result;
}

export async function deleteOrgChartNode(id: string) {
  const result = await hrDelete(COLLECTION, id);
  if (!result.success) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/org-chart');
  return result;
}
