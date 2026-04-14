import type { ObjectId } from 'mongodb';

/**
 * Worksuite HR extensions — ported from PHP/Laravel models:
 * EmployeeDetails, EmployeeDocument, EmployeeDocumentExpiry,
 * EmployeeSkill, EmployeeTeam, EmergencyContact, VisaDetail, Skill,
 * EmployeeLeaveQuota, EmployeeLeaveQuotaHistory.
 *
 * Every entity carries `userId` for tenant isolation.
 *
 * Collections:
 *   crm_employee_details, crm_employee_documents,
 *   crm_emergency_contacts, crm_visa_details, crm_skills,
 *   crm_employee_skills, crm_employee_teams,
 *   crm_employee_leave_quotas, crm_employee_leave_quota_history.
 */

type Owned = {
  _id: ObjectId;
  userId: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export type WsMaritalStatus = 'single' | 'married' | 'divorced' | 'widowed' | '';
export type WsGender = 'male' | 'female' | 'others' | '';
export type WsEmploymentType =
  | 'full-time'
  | 'part-time'
  | 'contract'
  | 'internship'
  | 'trainee'
  | '';

export type WsEmployeeDetail = Owned & {
  employee_id?: string;
  about_me?: string;
  marital_status?: WsMaritalStatus;
  notice_period?: number;
  address?: string;
  joining_date?: Date;
  last_date?: Date;
  reporting_to?: string;
  probation_end_date?: Date;
  employment_type?: WsEmploymentType;
  work_anniversary_notified?: boolean;
  slack_username?: string;
  overtime_hourly_rate?: number;
  notice_period_end_date?: Date;
  internship_end_date?: Date;
  contract_end_date?: Date;
  date_of_birth?: Date;
  marriage_anniversary_date?: Date;
  gender?: WsGender;
  blood_group?: string;
  religion?: string;
  nationality?: string;
  languages?: string[];
  hobbies?: string;
  hourly_rate?: number;
  bank_account_number?: string;
  bank_name?: string;
  tax_regime?: string;
};

export type WsEmployeeDocument = Owned & {
  /** Linked employee id (crm_employees._id). */
  user_id: string;
  name: string;
  file?: string;
  uploaded_at?: Date;
  expiry_date?: Date;
};

export type WsEmergencyContact = Owned & {
  user_id: string;
  name: string;
  relation?: string;
  phone?: string;
  address?: string;
};

export type WsVisaDetail = Owned & {
  user_id: string;
  country: string;
  visa_number?: string;
  issue_date?: Date;
  expiry_date?: Date;
  file?: string;
};

export type WsSkill = Owned & {
  name: string;
};

export type WsEmployeeSkill = Owned & {
  user_id: string;
  skill_id: string;
};

export type WsEmployeeTeam = Owned & {
  team_name: string;
  leader_user_id?: string;
};

export type WsEmployeeLeaveQuota = Owned & {
  user_id: string;
  leave_type_id: string;
  no_of_leaves: number;
};

export type WsEmployeeLeaveQuotaHistory = Owned & {
  user_id: string;
  leave_type_id: string;
  change: number;
  reason?: string;
  changed_at?: Date;
};
