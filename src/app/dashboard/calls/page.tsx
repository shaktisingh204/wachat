
'use client';

import { useEffect } from 'react';
import { redirect } from 'next/navigation';

// This component redirects the base /dashboard/calls route to the default logs tab.
export default function CallsRedirectPage() {
    useEffect(() => {
        redirect('/dashboard/calls/logs');
    }, []);
    return null; 
}
