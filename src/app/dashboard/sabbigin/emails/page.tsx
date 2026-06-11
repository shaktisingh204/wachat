import { redirect } from 'next/navigation';

/** Legacy emails log → unified activities, filtered to emails. */
export default function SabbiginEmailsRedirect() {
  redirect('/dashboard/sabbigin/activities?type=email');
}
