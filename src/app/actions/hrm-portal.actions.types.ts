/**
 * Types extracted from hrm-portal.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface PortalEmployeeProfile {
    _id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    email: string;
    status: CrmEmployee['status'];
    dateOfJoining: string | null;
    departmentId: string | null;
    designationId: string | null;
    departmentName: string | null;
    designationName: string | null;
    reportingManagerId: string | null;
    reportingManagerName: string | null;
}

export interface PortalTeamMember {
    _id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    email: string;
    status: CrmEmployee['status'];
    designationId: string | null;
    designationName: string | null;
    departmentId: string | null;
    departmentName: string | null;
}

export interface PortalTask {
    _id: string;
    title: string;
    description: string | null;
    status: CrmTask['status'];
    priority: CrmTask['priority'];
    dueDate: string | null;
    assignedTo: string | null;
    createdBy: string | null;
    createdAt: string;
    /** Hydrated display names — resolved by the action, not the UI. */
    assignedToName: string | null;
    createdByName: string | null;
}

export interface PortalKpis {
    teamSize: number;
    pendingTasks: number;
    completedThisWeek: number;
    pendingReports: number;
}
