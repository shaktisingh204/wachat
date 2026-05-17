'use client';

/**
 * New announcement — form page (§1B W7).
 */

import { AnnouncementForm } from '../_components/announcement-form';

export default function NewAnnouncementPage() {
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <AnnouncementForm mode="new" />
        </div>
    );
}
