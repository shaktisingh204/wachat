
'use client';

import { useEffect } from 'react';
import { redirect } from 'next/navigation';

export default function TeamRedirectPage() {
    useEffect(() => {
        redirect('/dashboard/crm/team/manage-users');
    }, []);
    return null; 
}
