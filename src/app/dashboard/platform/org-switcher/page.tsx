export const dynamic = "force-dynamic";

import { getOrganizations } from '@/app/actions/platform/org-switcher.actions';
import OrgSwitcherClient from './client';

export const metadata = {
  title: 'Organizations - Platform',
};

export default async function OrgSwitcherPage() {
  const data = await getOrganizations();

  return <OrgSwitcherClient initialData={data} />;
}
