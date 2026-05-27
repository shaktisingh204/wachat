import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function SabMailRootPage() {
    redirect('/dashboard/sabmail/inbox');
}
