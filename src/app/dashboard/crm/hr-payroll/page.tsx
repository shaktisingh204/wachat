'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react';

export default function HrPayrollRedirectPage() {
    useEffect(() => {
        redirect('/dashboard/crm/hr-payroll/employees');
    }, []);

    return null;
}
