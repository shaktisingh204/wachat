import { redirect } from 'next/navigation';

/**
 * The legacy single-screen signup has been replaced by the multi-step
 * onboarding wizard at `/onboarding`. This page exists only so that
 * bookmarks, marketing pages, and Firebase templates that still point
 * at `/signup` land the user in the new flow.
 */
export default function LegacySignupPage() {
    redirect('/onboarding');
}
