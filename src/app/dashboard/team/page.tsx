
'use client';

import { useEffect } from 'react';
import { redirect } from 'next/navigation';

export default function TeamRedirectPage() {
    useEffect(() => {
        redirect('/dashboard/team/manage-users');
    }, []);
    return null; 
}
