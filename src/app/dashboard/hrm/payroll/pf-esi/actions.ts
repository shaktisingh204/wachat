'use server';

import { getPayslips } from '@/app/actions/crm-payroll.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { startOfMonth } from 'date-fns';

const PF_RATE = 12;
const ESI_RATE = 0.75;
const ESI_WAGE_CEILING = 21000;

export async function getComplianceData(month: number, year: number) {
    const period = startOfMonth(new Date(year, month));
    
    const [payslipsData, employeesData] = await Promise.all([
        getPayslips(period),
        getCrmEmployees(),
    ]);

    const employeeMap = new Map(employeesData.map(e => [e._id.toString(), e]));

    // "Pre-calculated rounded figures"
    const enriched = payslipsData.map(slip => {
        const emp = employeeMap.get(slip.employeeId.toString());
        const pf = slip.deductions.find((d: any) => d.name?.includes('PF') || d.name?.includes('Provident'))?.amount ?? 0;
        const esi = slip.deductions.find((d: any) => d.name?.includes('ESI'))?.amount ?? 0;
        const basic = slip.earnings?.find((e: any) => e.name?.toLowerCase().includes('basic'))?.amount ?? 0;
        
        // Strict rounding calculations
        const pfRate = basic > 0 ? Math.round((pf / basic) * 100) : PF_RATE;
        const esiRate = slip.grossSalary > 0 ? Number(((esi / slip.grossSalary) * 100).toFixed(2)) : ESI_RATE;
        const esiApplicable = slip.grossSalary <= ESI_WAGE_CEILING;

        return {
            ...slip,
            employee: emp,
            pf: Math.round(pf),
            esi: Math.round(esi),
            pfRate,
            esiRate,
            esiApplicable,
            pfNumber: (emp as any)?.pfNumber ?? '—',
            esiNumber: (emp as any)?.esiNumber ?? '—',
            uan: (emp as any)?.uan ?? '—',
        };
    });

    return enriched;
}
