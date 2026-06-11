import { redirect } from 'next/navigation';

/** Legacy calls log → unified activities, filtered to calls. */
export default function SabbiginCallsRedirect() {
  redirect('/dashboard/sabbigin/activities?type=call');
}
