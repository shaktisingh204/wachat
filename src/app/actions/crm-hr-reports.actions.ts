
'use server';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { CrmEmployee } from '@/lib/definitions';
import { differenceInDays, format } from 'date-fns';

// ─── Attendance Report ────────────────────────────────────────────────────────

export async function generateAttendanceReportData(filters: {
    startDate?: Date;
    endDate?: Date;
    employeeId?: string;
    departmentId?: string;
}): Promise<{
    data?: {
        employeeId: string;
        employeeName: string;
        department: string;
        present: number;
        absent: number;
        late: number;
        wfh: number;
        halfDay: number;
        leave: number;
        totalWorkingDays: number;
        attendancePercentage: number;
    }[];
    summary?: { totalEmployees: number; overallAttendance: number; totalPresent: number; totalAbsent: number };
    error?: string;
}> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const empFilter: any = { userId, status: 'Active' };
        if (filters.employeeId) empFilter._id = new ObjectId(filters.employeeId);
        if (filters.departmentId) empFilter.departmentId = new ObjectId(filters.departmentId);

        const employees = await db.collection('crm_employees').aggregate([
            { $match: empFilter },
            {
                $lookup: {
                    from: 'crm_departments',
                    localField: 'departmentId',
                    foreignField: '_id',
                    as: 'deptInfo',
                }
            },
            { $unwind: { path: '$deptInfo', preserveNullAndEmptyArrays: true } },
        ]).toArray();

        if (employees.length === 0) {
            return { data: [], summary: { totalEmployees: 0, overallAttendance: 0, totalPresent: 0, totalAbsent: 0 } };
        }

        const dateFilter: any = {};
        if (filters.startDate) dateFilter.$gte = new Date(filters.startDate);
        if (filters.endDate) dateFilter.$lte = new Date(filters.endDate);

        const attendanceFilter: any = { userId };
        if (Object.keys(dateFilter).length > 0) attendanceFilter.date = dateFilter;

        const attendanceRecords = await db.collection('crm_attendance').find(attendanceFilter).toArray();

        const reportData = employees.map((emp: any) => {
            const empRecords = attendanceRecords.filter((a: any) => a.employeeId?.equals(emp._id));
            const present = empRecords.filter((a: any) => a.status === 'Present').length;
            const absent = empRecords.filter((a: any) => a.status === 'Absent').length;
            const late = empRecords.filter((a: any) => a.status === 'Late').length;
            const wfh = empRecords.filter((a: any) => a.status === 'WFH').length;
            const halfDay = empRecords.filter((a: any) => a.status === 'Half Day').length;
            const leave = empRecords.filter((a: any) => a.status === 'Leave').length;
            const totalWorkingDays = present + absent + late + wfh + halfDay + leave;
            const effectivePresent = present + wfh + late + halfDay * 0.5;
            const attendancePercentage = totalWorkingDays > 0 ? (effectivePresent / totalWorkingDays) * 100 : 0;

            return {
                employeeId: emp._id.toString(),
                employeeName: `${emp.firstName} ${emp.lastName}`,
                department: emp.deptInfo?.name || 'N/A',
                present,
                absent,
                late,
                wfh,
                halfDay,
                leave,
                totalWorkingDays,
                attendancePercentage,
            };
        });

        const totalPresent = reportData.reduce((s, r) => s + r.present, 0);
        const totalAbsent = reportData.reduce((s, r) => s + r.absent, 0);
        const overallAttendance =
            reportData.reduce((s, r) => s + r.attendancePercentage, 0) / (reportData.length || 1);

        return {
            data: JSON.parse(JSON.stringify(reportData)),
            summary: {
                totalEmployees: employees.length,
                overallAttendance,
                totalPresent,
                totalAbsent,
            },
        };
    } catch {
        return { error: 'Failed to generate attendance report.' };
    }
}

// ─── Leave Report ─────────────────────────────────────────────────────────────

export async function generateLeaveReportData(filters: {
    year?: number;
    employeeId?: string;
    leaveType?: string;
}): Promise<{
    data?: {
        employeeId: string;
        employeeName: string;
        leaveType: string;
        allocated: number;
        used: number;
        pending: number;
        remaining: number;
    }[];
    summary?: { totalEmployees: number; totalUsed: number; totalPending: number };
    error?: string;
}> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const year = filters.year || new Date().getFullYear();

        const yearStart = new Date(`${year}-01-01`);
        const yearEnd = new Date(`${year}-12-31`);

        const matchFilter: any = {
            userId,
            startDate: { $gte: yearStart, $lte: yearEnd },
        };
        if (filters.employeeId) matchFilter.employeeId = new ObjectId(filters.employeeId);
        if (filters.leaveType) matchFilter.leaveType = filters.leaveType;

        const requests = await db.collection('crm_leave_requests').aggregate([
            { $match: matchFilter },
            {
                $lookup: {
                    from: 'crm_employees',
                    localField: 'employeeId',
                    foreignField: '_id',
                    as: 'emp',
                },
            },
            { $unwind: '$emp' },
        ]).toArray();

        // Aggregate per employee+leaveType
        const map: Record<string, {
            employeeId: string; employeeName: string; leaveType: string;
            allocated: number; used: number; pending: number;
        }> = {};

        requests.forEach((req: any) => {
            const key = `${req.employeeId}-${req.leaveType || 'General'}`;
            if (!map[key]) {
                map[key] = {
                    employeeId: req.employeeId.toString(),
                    employeeName: `${req.emp.firstName} ${req.emp.lastName}`,
                    leaveType: req.leaveType || 'General',
                    allocated: req.emp.leaveBalance?.[req.leaveType] ?? 12,
                    used: 0,
                    pending: 0,
                };
            }
            const days = differenceInDays(new Date(req.endDate), new Date(req.startDate)) + 1;
            if (req.status === 'Approved') map[key].used += days;
            else if (req.status === 'Pending') map[key].pending += days;
        });

        const data = Object.values(map).map(row => ({
            ...row,
            remaining: Math.max(0, row.allocated - row.used),
        }));

        const totalUsed = data.reduce((s, r) => s + r.used, 0);
        const totalPending = data.reduce((s, r) => s + r.pending, 0);
        const uniqueEmployees = new Set(data.map(r => r.employeeId)).size;

        return {
            data: JSON.parse(JSON.stringify(data)),
            summary: { totalEmployees: uniqueEmployees, totalUsed, totalPending },
        };
    } catch (e) {
        console.error('Failed to generate leave report:', e);
        return { error: 'Could not generate leave report.' };
    }
}

// ─── Payroll Summary ──────────────────────────────────────────────────────────

export async function generatePayrollSummaryData(filters: {
    month?: number;
    year?: number;
    departmentId?: string;
}): Promise<{
    data?: {
        rows: {
            employeeId: string;
            employeeName: string;
            department: string;
            grossSalary: number;
            pf: number;
            esi: number;
            tds: number;
            professionalTax: number;
            totalDeductions: number;
            netPay: number;
        }[];
        totals: {
            grossSalary: number; pf: number; esi: number; tds: number;
            professionalTax: number; totalDeductions: number; netPay: number;
        };
        totalEmployees: number;
        totalPayroll: number;
    };
    error?: string;
}> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const empFilter: any = { userId, status: 'Active' };
        if (filters.departmentId) empFilter.departmentId = new ObjectId(filters.departmentId);

        const employees = await db.collection('crm_employees').aggregate([
            { $match: empFilter },
            {
                $lookup: {
                    from: 'crm_departments',
                    localField: 'departmentId',
                    foreignField: '_id',
                    as: 'deptInfo',
                },
            },
            { $unwind: { path: '$deptInfo', preserveNullAndEmptyArrays: true } },
        ]).toArray();

        // Try to find payslips for the given month/year
        const month = filters.month ?? new Date().getMonth() + 1;
        const year = filters.year ?? new Date().getFullYear();
        const periodStart = new Date(year, month - 1, 1);
        const periodEnd = new Date(year, month, 0, 23, 59, 59);

        const payslips = await db.collection('crm_payslips').find({
            userId,
            payPeriodStart: { $gte: periodStart, $lte: periodEnd },
        }).toArray();

        const payslipMap: Record<string, any> = {};
        payslips.forEach((p: any) => { payslipMap[p.employeeId.toString()] = p; });

        const rows = employees.map((emp: any) => {
            const payslip = payslipMap[emp._id.toString()];
            const grossSalary = payslip?.grossSalary ?? emp.salaryDetails?.grossSalary ?? 0;

            // Standard Indian payroll deduction approximations
            const pf = payslip
                ? (payslip.deductions?.find((d: any) => /pf|provident/i.test(d.name))?.amount ?? Math.round(grossSalary * 0.12))
                : Math.round(grossSalary * 0.12);
            const esi = payslip
                ? (payslip.deductions?.find((d: any) => /esi/i.test(d.name))?.amount ?? (grossSalary <= 21000 ? Math.round(grossSalary * 0.0075) : 0))
                : (grossSalary <= 21000 ? Math.round(grossSalary * 0.0075) : 0);
            const tds = payslip
                ? (payslip.deductions?.find((d: any) => /tds|tax deducted/i.test(d.name))?.amount ?? 0)
                : 0;
            const professionalTax = payslip
                ? (payslip.deductions?.find((d: any) => /professional tax|pt/i.test(d.name))?.amount ?? 200)
                : 200;
            const totalDeductions = pf + esi + tds + professionalTax;
            const netPay = grossSalary - totalDeductions;

            return {
                employeeId: emp._id.toString(),
                employeeName: `${emp.firstName} ${emp.lastName}`,
                department: emp.deptInfo?.name || 'N/A',
                grossSalary,
                pf,
                esi,
                tds,
                professionalTax,
                totalDeductions,
                netPay,
            };
        });

        const sum = (key: keyof (typeof rows)[0]) =>
            rows.reduce((s, r) => s + (r[key] as number), 0);

        const totals = {
            grossSalary: sum('grossSalary'),
            pf: sum('pf'),
            esi: sum('esi'),
            tds: sum('tds'),
            professionalTax: sum('professionalTax'),
            totalDeductions: sum('totalDeductions'),
            netPay: sum('netPay'),
        };

        return {
            data: {
                rows: JSON.parse(JSON.stringify(rows)),
                totals,
                totalEmployees: employees.length,
                totalPayroll: totals.grossSalary,
            },
        };
    } catch (e) {
        console.error('Failed to generate payroll summary:', e);
        return { error: 'Could not generate payroll summary.' };
    }
}

// ─── Salary Register ──────────────────────────────────────────────────────────

export async function generateSalaryRegisterData(filters: {
    month?: number;
    year?: number;
}): Promise<{
    data?: {
        employeeId: string;
        employeeName: string;
        department: string;
        basic: number;
        hra: number;
        specialAllowance: number;
        otherEarnings: number;
        totalGross: number;
        pf: number;
        esi: number;
        tds: number;
        totalDeductions: number;
        netPay: number;
    }[];
    summary?: { totalGross: number; totalDeductions: number; totalNetPay: number; totalEmployees: number };
    error?: string;
}> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const month = filters.month ?? new Date().getMonth() + 1;
        const year = filters.year ?? new Date().getFullYear();
        const periodStart = new Date(year, month - 1, 1);
        const periodEnd = new Date(year, month, 0, 23, 59, 59);

        const employees = await db.collection('crm_employees').aggregate([
            { $match: { userId, status: 'Active' } },
            {
                $lookup: {
                    from: 'crm_departments',
                    localField: 'departmentId',
                    foreignField: '_id',
                    as: 'deptInfo',
                },
            },
            { $unwind: { path: '$deptInfo', preserveNullAndEmptyArrays: true } },
        ]).toArray();

        const payslips = await db.collection('crm_payslips').find({
            userId,
            payPeriodStart: { $gte: periodStart, $lte: periodEnd },
        }).toArray();

        const payslipMap: Record<string, any> = {};
        payslips.forEach((p: any) => { payslipMap[p.employeeId.toString()] = p; });

        const data = employees.map((emp: any) => {
            const payslip = payslipMap[emp._id.toString()];
            const gross = payslip?.grossSalary ?? emp.salaryDetails?.grossSalary ?? 0;

            const getEarning = (pattern: RegExp) =>
                payslip?.earnings?.find((e: any) => pattern.test(e.name))?.amount ?? 0;
            const getDeduction = (pattern: RegExp) =>
                payslip?.deductions?.find((d: any) => pattern.test(d.name))?.amount ?? 0;

            // Derive components — use payslip if present, else estimate from gross
            const basic = payslip ? getEarning(/basic/i) : Math.round(gross * 0.5);
            const hra = payslip ? getEarning(/hra|house rent/i) : Math.round(gross * 0.2);
            const specialAllowance = payslip
                ? getEarning(/special/i)
                : Math.round(gross * 0.2);
            const otherEarnings = payslip
                ? (payslip.earnings ?? [])
                    .filter((e: any) => !/basic|hra|house rent|special/i.test(e.name))
                    .reduce((s: number, e: any) => s + e.amount, 0)
                : Math.round(gross * 0.1);
            const totalGross = payslip ? gross : basic + hra + specialAllowance + otherEarnings;

            const pf = payslip ? getDeduction(/pf|provident/i) : Math.round(basic * 0.12);
            const esi = payslip
                ? getDeduction(/esi/i)
                : (totalGross <= 21000 ? Math.round(totalGross * 0.0075) : 0);
            const tds = payslip ? getDeduction(/tds|tax deducted/i) : 0;
            const totalDeductions = pf + esi + tds;
            const netPay = totalGross - totalDeductions;

            return {
                employeeId: emp._id.toString(),
                employeeName: `${emp.firstName} ${emp.lastName}`,
                department: emp.deptInfo?.name || 'N/A',
                basic,
                hra,
                specialAllowance,
                otherEarnings,
                totalGross,
                pf,
                esi,
                tds,
                totalDeductions,
                netPay,
            };
        });

        const totalGross = data.reduce((s, r) => s + r.totalGross, 0);
        const totalDeductions = data.reduce((s, r) => s + r.totalDeductions, 0);
        const totalNetPay = data.reduce((s, r) => s + r.netPay, 0);

        return {
            data: JSON.parse(JSON.stringify(data)),
            summary: { totalGross, totalDeductions, totalNetPay, totalEmployees: data.length },
        };
    } catch (e) {
        console.error('Failed to generate salary register:', e);
        return { error: 'Could not generate salary register.' };
    }
}

// ─── Departments helper ───────────────────────────────────────────────────────

export async function getReportDepartments(): Promise<{ data?: { _id: string; name: string }[]; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const depts = await db.collection('crm_departments').find({ userId }).toArray();
        return { data: JSON.parse(JSON.stringify(depts.map((d: any) => ({ _id: d._id.toString(), name: d.name })))) };
    } catch {
        return { error: 'Could not fetch departments.' };
    }
}

export async function getReportEmployees(): Promise<{ data?: { _id: string; name: string }[]; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const emps = await db.collection('crm_employees').find({ userId, status: 'Active' }).toArray();
        return {
            data: JSON.parse(JSON.stringify(
                emps.map((e: any) => ({ _id: e._id.toString(), name: `${e.firstName} ${e.lastName}` }))
            ))
        };
    } catch {
        return { error: 'Could not fetch employees.' };
    }
}

export async function getReportLeaveTypes(): Promise<{ data?: string[]; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const types = await db.collection('crm_leave_requests')
            .distinct('leaveType', { userId });
        return { data: types.filter(Boolean) };
    } catch {
        return { error: 'Could not fetch leave types.' };
    }
}
