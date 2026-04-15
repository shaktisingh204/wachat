import { EmployeeForm } from '@/components/wabasimplify/crm-employee-form';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCrmDepartments, getCrmDesignations, getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { getEmployeeDetailByEmployeeId } from '@/app/actions/worksuite/hr-ext.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { ClayButton } from '@/components/clay';

async function getEmployeeById(id: string) {
  if (!ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const employee = await db.collection('crm_employees').findOne({ _id: new ObjectId(id) });
  return JSON.parse(JSON.stringify(employee));
}

export default async function EditEmployeePage(
  props: { params: Promise<{ employeeId: string }> }
) {
  const params = await props.params;
  const employeeId = params.employeeId;

  const [employee, departments, designations, managers, detail] = await Promise.all([
    getEmployeeById(employeeId),
    getCrmDepartments(),
    getCrmDesignations(),
    getCrmEmployees(),
    getEmployeeDetailByEmployeeId(employeeId),
  ]);

  if (!employee) {
    return <p className="text-[13px] text-clay-ink-muted">Employee not found.</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <Link href="/dashboard/hrm/payroll/employees" className="inline-flex">
          <ClayButton variant="ghost" leading={<ArrowLeft className="h-4 w-4" strokeWidth={1.75} />}>
            Back to Employee Directory
          </ClayButton>
        </Link>
        <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight text-clay-ink">Edit Employee</h1>
      </div>

      <EmployeeForm
        employee={employee}
        departments={departments}
        designations={designations}
        managers={managers}
        detail={detail}
      />
    </div>
  );
}
