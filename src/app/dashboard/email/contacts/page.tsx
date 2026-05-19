import { redirect } from 'next/navigation';

// Legacy path; the audience surface lives at /dashboard/email/audience now.
export default function EmailContactsRedirect() {
  redirect('/dashboard/email/audience');
}
