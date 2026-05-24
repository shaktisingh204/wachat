import { readFile, writeFile } from 'fs/promises';

async function run() {
    const filePath = 'src/app/actions/crm-payroll.actions.ts';
    let code = await readFile(filePath, 'utf-8');

    if (!code.includes('import { getTransporter }')) {
        code = code.replace(
            "import { getErrorMessage } from '@/lib/utils';",
            "import { getErrorMessage } from '@/lib/utils';\nimport { getTransporter } from '@/lib/email-service';"
        );
    }

    const oldFn = `export async function sendPayslipsEmail(month: number, year: number): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const payPeriodStart = startOfMonth(new Date(year, month - 1));
        
        await db.collection('crm_payslips').updateMany(
            { userId, payPeriodStart, status: 'paid' },
            { $set: { emailedAt: new Date() } }
        );

        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}`;

    const newFn = `export async function sendPayslipsEmail(month: number, year: number): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const payPeriodStart = startOfMonth(new Date(year, month - 1));
        
        const payslips = await db.collection<CrmPayslip>('crm_payslips').find({
            userId, payPeriodStart, status: 'paid'
        }).toArray();

        if (payslips.length === 0) {
            return { success: false, error: 'No paid payslips found to send.' };
        }

        const employeeIds = payslips.map(p => p.employeeId);
        const employees = await db.collection<CrmEmployee>('crm_employees').find({ _id: { $in: employeeIds } }).toArray();
        const employeeMap = new Map(employees.map(e => [e._id.toString(), e]));

        const transporter = await getTransporter(session.user._id);

        for (const payslip of payslips) {
            const emp = employeeMap.get(payslip.employeeId.toString());
            const email = emp?.email || emp?.personalEmail;
            
            if (email && emp) {
                const monthName = payPeriodStart.toLocaleString('default', { month: 'long' });
                await transporter.sendMail({
                    to: email,
                    subject: \`Payslip for \${monthName} \${year}\`,
                    text: \`Dear \${emp.firstName},\\n\\nPlease find your payslip for \${monthName} \${year}.\\n\\nGross Salary: \${payslip.grossSalary}\\nNet Salary: \${payslip.netPay}\\n\\nRegards,\\nHR Team\`,
                });
            }
        }

        await db.collection('crm_payslips').updateMany(
            { userId, payPeriodStart, status: 'paid' },
            { $set: { emailedAt: new Date() } }
        );

        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}`;

    if (code.includes(oldFn)) {
        code = code.replace(oldFn, newFn);
        await writeFile(filePath, code);
        console.log('Successfully patched sendPayslipsEmail');
    } else {
        console.log('Could not find sendPayslipsEmail block.');
    }
}

run().catch(console.error);
