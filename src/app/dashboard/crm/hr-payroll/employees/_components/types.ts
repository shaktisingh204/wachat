export interface EmployeeListRow {
  _id: string;
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  photoFileId?: string;
  workEmail?: string;
  workPhone?: string;
  personalPhone?: string;
  departmentId?: string | null;
  designationId?: string | null;
  designation?: string;
  reportingManagerId?: string | null;
  status?: string;
  employmentType?: string;
  joiningDate?: string | null;
  exitDate?: string | null;
  workLocation?: string;
  ctc?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
