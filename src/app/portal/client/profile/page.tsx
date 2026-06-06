import React from "react";
/**
 * /portal/client/profile — view/edit profile + view-only company info.
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

import { getClientProfile } from '@/app/actions/client-portal.actions';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';
import { ProfileForm } from '@/components/client-portal/profile-form';

async function ClientProfilePageContent() {
    const profile = await getClientProfile();
    if (!profile) {
        redirect('/login?return=/portal/client/profile');
    }

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="text-2xl font-semibold text-[var(--st-text)]">Profile</h1>
                <p className="text-sm text-[var(--st-text-secondary)]">
                    Manage your account details.
                </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Account</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <ProfileForm
                            initialName={profile.name}
                            email={profile.email}
                            initialMobile={profile.mobile ?? ''}
                            initialAvatarUrl={profile.avatarUrl ?? ''}
                            initialTwoFactorEnabled={profile.twoFactorEnabled ?? false}
                            initialNotificationPreferences={profile.notificationPreferences ?? { email: true, sms: false }}
                        />
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Company</CardTitle>
                    </CardHeader>
                    <CardBody>
                        {profile.company ? (
                            <dl className="grid grid-cols-1 gap-3 text-sm">
                                <div>
                                    <dt className="text-xs text-[var(--st-text-secondary)]">Company name</dt>
                                    <dd className="text-[var(--st-text)]">{profile.company.companyName ?? '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-[var(--st-text-secondary)]">Contact name</dt>
                                    <dd className="text-[var(--st-text)]">{profile.company.contactName ?? '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-[var(--st-text-secondary)]">Country</dt>
                                    <dd className="text-[var(--st-text)]">{profile.company.country ?? '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-[var(--st-text-secondary)]">Website</dt>
                                    <dd className="break-all text-[var(--st-text)]">{profile.company.website ?? '—'}</dd>
                                </div>
                            </dl>
                        ) : (
                            <p className="text-sm text-[var(--st-text-secondary)]">
                                No company profile on file. Contact support to update your
                                company details.
                            </p>
                        )}
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}


export default function ClientProfilePage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <ClientProfilePageContent  />
    </React.Suspense>
  );
}
