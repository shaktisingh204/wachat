
'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react';

export default function HrReportsRedirectPage() {
    useEffect(() => {
        redirect('/dashboard/hrm/payroll/reports/attendance');
    }, []);

    return null;
}
