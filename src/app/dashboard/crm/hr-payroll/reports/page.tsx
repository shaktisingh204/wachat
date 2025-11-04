
'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react';

export default function HrReportsRedirectPage() {
    useEffect(() => {
        redirect('/dashboard/crm/hr-payroll/reports/attendance');
    }, []);

    return null;
}
