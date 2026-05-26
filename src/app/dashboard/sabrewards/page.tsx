import { redirect } from 'next/navigation';

export default function RewardsIndexPage(): never {
  redirect('/dashboard/sabrewards/dashboard');
}
