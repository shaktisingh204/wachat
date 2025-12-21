import { EmployeeForm } from '@/components/wabasimplify/crm-employee-form';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCrmDepartments, getCrmDesignations, getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

async function getEmployeeById(id: string) {
  if (!ObjectId.isValid(id)) return null;

  const { db } = await connectToDatabase();
  const employee = await db
    .collection('crm_employees')
    .findOne({ _id: new ObjectId(id) });

  return JSON.parse(JSON.stringify(employee));
}

export default async function EditEmployeePage({
  params,
}: {
  params: { employeeId: string };
}) {
  const employeeId = params.employeeId;

  const [employee, departments, designations, managers] =
    await Promise.all([
      getEmployeeById(employeeId),
      getCrmDepartments(),
      getCrmDesignations(),
      getCrmEmployees(),
    ]);

  if (!employee) {
    return <p>Employee not found.</p>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Button variant="ghost" asChild className="-ml-4">
          <Link href="/dashboard/crm/hr-payroll/employees">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Employee Directory
          </Link>
        </Button>

        <h1 className="text-3xl font-bold font-headline mt-2">
          Edit Employee
        </h1>
      </div>

      <EmployeeForm
        employee={employee}
        departments={departments}
        designations={designations}
        managers={managers}
      />
    </div>
  );
}
