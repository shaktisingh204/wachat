import { getLeadCategories, getLeadCategoryKpis } from '@/app/actions/worksuite/crm-plus.actions';
import type { WsLeadCategory } from '@/lib/worksuite/crm-types';
import type { WithId } from 'mongodb';
import { CategoriesClient } from './_components/categories-client';

export const dynamic = 'force-dynamic';

type Row = WithId<WsLeadCategory> & { _id: string };

export default async function LeadCategoriesPage() {
  const [rows, kpi] = await Promise.all([
    getLeadCategories(),
    getLeadCategoryKpis(),
  ]);

  return <CategoriesClient rows={rows as Row[]} kpi={kpi} />;
}
