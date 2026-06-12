'use client';

import { useEffect } from 'react';
import { useProject } from '@/context/project-context';
import { Spinner } from '@/components/sabcrm/20ui';

/**
 * Website Builder (SabSites) — the Webstudio-powered builder is mounted
 * inside this app at /sites (vendor/webstudio via the /sites catch-all
 * route). This page only plan-gates and forwards; auth is unified through
 * the SabNode session cookie, so there is no separate login.
 */
export default function WebsiteBuilderPage() {
    const { sessionUser } = useProject();
    const isAllowed = sessionUser?.plan?.features?.websiteBuilder ?? false;

    useEffect(() => {
        if (isAllowed) {
            window.location.replace('/sites/');
        }
    }, [isAllowed]);

    // When the plan lacks the feature, the layout's FeatureLockOverlay shows.
    return (
        <div className="flex h-64 items-center justify-center">
            <Spinner />
        </div>
    );
}
