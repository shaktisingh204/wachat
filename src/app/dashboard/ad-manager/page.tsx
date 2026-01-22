
'use client';

import { useEffect } from 'react';
import { redirect } from 'next/navigation';

export default function AdManagerRedirectPage() {
    useEffect(() => {
        redirect('/dashboard/ad-manager/ad-accounts');
    }, []);
    return null;
}
