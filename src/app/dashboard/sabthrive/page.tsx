import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function SabThriveRootPage() {
    redirect('/dashboard/sabthrive/loyalty');
}
