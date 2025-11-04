
'use server';

import { getSession } from '@/app/actions/index.ts';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, type WithId, Filter } from 'mongodb';
import { CrmAttendance, CrmEmployee } from '@/lib/definitions';
import { differenceInDays, startOfMonth, endOfMonth, eachMonthOfInterval, format } from 'date-fns';

export async function generateAttendanceReportData(filters: { startDate?: Date; endDate?: Date }): Promise<{ data?: any[]; summary?: any; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { error: 'Authentication required.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const employees = await db.collection<CrmEmployee>('crm_employees').find({ userId, status: 'Active' }).toArray();
        if (employees.length === 0) {
            return { data: [], summary: { totalEmployees: 0, overallAttendance: 0 } };
        }

        const dateFilter: any = {};
        if (filters.startDate) dateFilter.$gte = new Date(filters.startDate);
        if (filters.endDate) dateFilter.$lte = new Date(filters.endDate);

        const attendanceFilter: Filter<CrmAttendance> = { userId };
        if (filters.startDate || filters.endDate) {
            attendanceFilter.date = dateFilter;
        }

        const attendanceRecords = await db.collection<CrmAttendance>('crm_attendance').find(attendanceFilter).toArray();
        
        const reportData = employees.map(emp => {
            const empAttendance = attendanceRecords.filter(a => a.employeeId.equals(emp._id));
            const present = empAttendance.filter(a => a.status === 'Present').length;
            const absent = empAttendance.filter(a => a.status === 'Absent').length;
            const halfDay = empAttendance.filter(a => a.status === 'Half Day').length;
            const leave = empAttendance.filter(a => a.status === 'Leave').length;
            const totalDays = present + absent + halfDay + leave;

            return {
                employeeId: emp._id.toString(),
                employeeName: `${emp.firstName} ${emp.lastName}`,
                present,
                absent,
                halfDay,
                leave,
                totalDays,
                attendancePercentage: totalDays > 0 ? ((present + halfDay * 0.5) / totalDays) * 100 : 0
            };
        });
        
        const totalEmployees = employees.length;
        const overallAttendance = reportData.reduce((acc, curr) => acc + curr.attendancePercentage, 0) / (reportData.length || 1);

        return {
            data: JSON.parse(JSON.stringify(reportData)),
            summary: {
                totalEmployees,
                overallAttendance,
            }
        };

    } catch (e: any) {
        return { error: 'Failed to generate attendance report.' };
    }
}

export async function generateLeaveReportData(filters: {}): Promise<{ data?: any[], error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { error: 'Authentication required.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const leaveRequests = await db.collection('crm_leave_requests').aggregate([
            { $match: { userId, status: 'Approved' } },
            {
                $lookup: {
                    from: 'crm_employees',
                    localField: 'employeeId',
                    foreignField: '_id',
                    as: 'employeeInfo'
                }
            },
            { $unwind: '$employeeInfo' },
            {
                $project: {
                    employeeId: '$employeeId',
                    employeeName: { $concat: ['$employeeInfo.firstName', ' ', '$employeeInfo.lastName'] },
                    startDate: '$startDate',
                    endDate: '$endDate'
                }
            }
        ]).toArray();

        const reportMap: { [key: string]: { employeeName: string, totalLeaveDays: number } } = {};

        leaveRequests.forEach((req: any) => {
            if (!reportMap[req.employeeId]) {
                reportMap[req.employeeId] = {
                    employeeName: req.employeeName,
                    totalLeaveDays: 0
                };
            }
            const duration = differenceInDays(new Date(req.endDate), new Date(req.startDate)) + 1;
            reportMap[req.employeeId].totalLeaveDays += duration;
        });
        
        const reportData = Object.values(reportMap);

        return { data: JSON.parse(JSON.stringify(reportData)) };
    } catch (e) {
        console.error("Failed to generate leave report:", e);
        return { error: "Could not generate leave report." };
    }
}

export async function generatePayrollSummaryData(filters: {}): Promise<{ data?: any, error?: string }> {
     const session = await getSession();
    if (!session?.user) {
        return { error: 'Authentication required.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const employees = await db.collection<CrmEmployee>('crm_employees').find({ userId, status: 'Active' }).toArray();
        const totalEmployees = employees.length;
        const totalPayroll = employees.reduce((sum, emp) => sum + (emp.salaryDetails?.grossSalary || 0), 0);

        // Generate mock data for the last 6 months
        const monthlyData = [];
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const randomFactor = 0.95 + Math.random() * 0.1;
            monthlyData.push({
                name: format(date, 'MMM'),
                cost: Math.round(totalPayroll * randomFactor),
            });
        }
        
        return { data: { totalEmployees, totalPayroll, monthlyData } };

    } catch (e) {
        console.error("Failed to generate payroll summary:", e);
        return { error: "Could not generate payroll summary." };
    }
}

export async function generateSalaryRegisterData(filters: {}): Promise<{ data?: any[], error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const employees = await db.collection('crm_employees').aggregate([
            { $match: { userId, status: 'Active' } },
            {
                $lookup: {
                    from: 'crm_departments',
                    localField: 'departmentId',
                    foreignField: '_id',
                    as: 'departmentInfo'
                }
            },
            { $unwind: { path: '$departmentInfo', preserveNullAndEmptyArrays: true } }
        ]).toArray();
        
        const reportData = employees.map((emp: any) => {
            const grossSalary = emp.salaryDetails?.grossSalary || 0;
            // Mock deductions for now
            const deductions = grossSalary * 0.12; 
            const netSalary = grossSalary - deductions;

            return {
                _id: emp._id.toString(),
                employeeName: `${emp.firstName} ${emp.lastName}`,
                department: emp.departmentInfo?.name || 'N/A',
                grossSalary,
                deductions,
                netSalary
            };
        });

        return { data: reportData };
    } catch (e) {
        console.error("Failed to generate salary register:", e);
        return { error: "Could not generate salary register." };
    }
}
