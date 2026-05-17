/**
 * CRM HRM surface — employees, candidates, jobs, interviews, attendance,
 * leaves, payroll, payslips, salary structures, holidays, departments,
 * branches, shifts.
 */

import type { EndpointSpec } from '../types';
import { crudExtendedResource } from '../crud-extended';
import { crudResource } from '../crud-template';

export const crmHrmEndpoints: ReadonlyArray<EndpointSpec> = [
  ...crudExtendedResource({
    module: 'crm',
    resource: 'employees',
    basePath: '/crm/employees',
    rustPath: '/v1/crm/employees',
    scopeRead: 'crm:hr:read',
    scopeWrite: 'crm:hr:write',
    emits: { create: 'crm.employee.created', update: 'crm.employee.updated', delete: 'crm.employee.deleted' },
  }),
  ...crudExtendedResource({
    module: 'crm',
    resource: 'candidates',
    basePath: '/crm/candidates',
    rustPath: '/v1/crm/candidates',
    scopeRead: 'crm:hr:read',
    scopeWrite: 'crm:hr:write',
  }),
  ...crudExtendedResource({
    module: 'crm',
    resource: 'jobs',
    basePath: '/crm/jobs',
    rustPath: '/v1/crm/jobs',
    scopeRead: 'crm:hr:read',
    scopeWrite: 'crm:hr:write',
  }),
  ...crudExtendedResource({
    module: 'crm',
    resource: 'interviews',
    basePath: '/crm/interviews',
    rustPath: '/v1/crm/interviews',
    scopeRead: 'crm:hr:read',
    scopeWrite: 'crm:hr:write',
  }),
  ...crudExtendedResource({
    module: 'crm',
    resource: 'attendance',
    basePath: '/crm/attendance',
    rustPath: '/v1/crm/attendance',
    scopeRead: 'crm:hr:read',
    scopeWrite: 'crm:hr:write',
    idParam: 'attendanceId',
    display: 'attendance records',
  }),
  ...crudExtendedResource({
    module: 'crm',
    resource: 'leaves',
    basePath: '/crm/leaves',
    rustPath: '/v1/crm/leaves',
    scopeRead: 'crm:hr:read',
    scopeWrite: 'crm:hr:write',
    emits: { create: 'crm.leave.requested', update: 'crm.leave.updated' },
  }),
  ...crudExtendedResource({
    module: 'crm',
    resource: 'payroll-runs',
    basePath: '/crm/payroll-runs',
    rustPath: '/v1/crm/payroll-runs',
    scopeRead: 'crm:hr:read',
    scopeWrite: 'crm:hr:write',
    idParam: 'payrollRunId',
    emits: { create: 'crm.payroll.run.started' },
  }),
  ...crudResource({
    module: 'crm',
    resource: 'payslips',
    basePath: '/crm/payslips',
    rustPath: '/v1/crm/payslips',
    scopeRead: 'crm:hr:read',
    scopeWrite: 'crm:hr:write',
    verbs: ['list', 'get'],
  }),
  ...crudExtendedResource({
    module: 'crm',
    resource: 'salary-structures',
    basePath: '/crm/salary-structures',
    rustPath: '/v1/crm/salary-structures',
    scopeRead: 'crm:hr:read',
    scopeWrite: 'crm:hr:write',
    idParam: 'salaryStructureId',
  }),
  ...crudExtendedResource({
    module: 'crm',
    resource: 'holidays',
    basePath: '/crm/holidays',
    rustPath: '/v1/crm/holidays',
    scopeRead: 'crm:hr:read',
    scopeWrite: 'crm:hr:write',
  }),
  ...crudExtendedResource({
    module: 'crm',
    resource: 'departments',
    basePath: '/crm/departments',
    rustPath: '/v1/crm/departments',
    scopeRead: 'crm:hr:read',
    scopeWrite: 'crm:hr:write',
  }),
];
