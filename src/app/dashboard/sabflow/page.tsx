
'use client';

import { useEffect } from 'react';
import { redirect } from 'next/navigation';

export default function SabFlowRedirectPage() {
    useEffect(() => {
        redirect('/dashboard/sabflow/flow-builder');
    }, []);
    return null; 
}
