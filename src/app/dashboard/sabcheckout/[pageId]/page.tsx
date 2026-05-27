/**
 * SabCheckout page editor — `/dashboard/sabcheckout/[pageId]`.
 *
 * The `[pageId]` slot doubles as a "new" route: when `pageId === 'new'`
 * we render the editor in blank-create mode. Otherwise we fetch the
 * existing page + plan list and pass them through.
 */
import { notFound } from 'next/navigation';

import {
  getSabcheckoutPage,
  listSabcheckoutPlans,
} from '@/app/actions/sabcheckout.actions';
import { SabcheckoutPageEditor } from '../_components/sabcheckout-page-editor';

export const dynamic = 'force-dynamic';

export default async function SabcheckoutPageEditorRoute({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const plansRes = await listSabcheckoutPlans({ status: 'active', limit: 100 });
  const plans = plansRes.ok ? plansRes.data.items : [];

  if (pageId === 'new') {
    return <SabcheckoutPageEditor plans={plans} />;
  }

  const res = await getSabcheckoutPage(pageId);
  if (!res.ok) {
    notFound();
  }
  return <SabcheckoutPageEditor initial={res.data} plans={plans} />;
}
