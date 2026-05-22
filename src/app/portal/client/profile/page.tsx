/**
 * /portal/client/profile — view/edit profile + view-only company info.
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

import { getClientProfile } from '@/app/actions/client-portal.actions';
import {
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/zoruui/card';
import { ProfileForm } from '@/components/client-portal/profile-form';

export default async function ClientProfilePage() {
    const profile = await getClientProfile();
    if (!profile) {
        redirect('/login?return=/portal/client/profile');
    }

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="text-2xl font-semibold text-zoru-ink">Profile</h1>
                <p className="text-sm text-zoru-ink-muted">
                    Manage your account details.
                </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Account</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <ProfileForm
                            initialName={profile.name}
                            email={profile.email}
                            initialMobile={profile.mobile ?? ''}
                        />
                    </ZoruCardContent>
                </ZoruCard>

                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Company</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        {profile.company ? (
                            <dl className="grid grid-cols-1 gap-3 text-sm">
                                <div>
                                    <dt className="text-xs text-zoru-ink-muted">Company name</dt>
                                    <dd className="text-zoru-ink">{profile.company.companyName ?? '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-zoru-ink-muted">Contact name</dt>
                                    <dd className="text-zoru-ink">{profile.company.contactName ?? '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-zoru-ink-muted">Country</dt>
                                    <dd className="text-zoru-ink">{profile.company.country ?? '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-zoru-ink-muted">Website</dt>
                                    <dd className="break-all text-zoru-ink">{profile.company.website ?? '—'}</dd>
                                </div>
                            </dl>
                        ) : (
                            <p className="text-sm text-zoru-ink-muted">
                                No company profile on file. Contact support to update your
                                company details.
                            </p>
                        )}
                    </ZoruCardContent>
                </ZoruCard>
            </div>
        </div>
    );
}
