import { redirect } from 'next/navigation';

// Legacy path; DNS / DKIM / DMARC verification is part of /dashboard/email/deliverability.
export default function EmailVerificationRedirect() {
  redirect('/dashboard/email/deliverability');
}
