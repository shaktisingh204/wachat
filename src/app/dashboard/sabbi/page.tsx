import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function SabBiRootPage() {
    redirect('/dashboard/sabbi/analytics');
}
