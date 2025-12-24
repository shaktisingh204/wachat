
'use client';

import { useEffect } from 'react';
import { redirect } from 'next/navigation';

// This component redirects the base /dashboard/calls route to the default setup tab.
export default function CallsRedirectPage() {
    useEffect(() => {
        redirect('/dashboard/calls/settings');
    }, []);
    return null; 
}
