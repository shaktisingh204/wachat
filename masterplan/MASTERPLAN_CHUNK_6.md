# Masterplan Chunk 6

This document details the analysis of legacy CRM HR and Payroll route files.

## `src/app/dashboard/crm/hr/succession/page.tsx`
- **Route / Component**: `/dashboard/crm/hr/succession`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/hr/succession`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr/surveys/page.tsx`
- **Route / Component**: `/dashboard/crm/hr/surveys`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/hr/surveys`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr/timesheets/[id]/edit/page.tsx`
- **Route / Component**: `/dashboard/crm/hr/timesheets/[id]/edit`
- **Current Features**: Dynamically extracts route parameters (e.g., `id`) and search parameters, then redirects the request to `/dashboard/hrm/hr/timesheets/[id]/edit` preserving the parameters. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr/timesheets/[id]/page.tsx`
- **Route / Component**: `/dashboard/crm/hr/timesheets/[id]`
- **Current Features**: Dynamically extracts route parameters (e.g., `id`) and search parameters, then redirects the request to `/dashboard/hrm/hr/timesheets/[id]` preserving the parameters. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr/timesheets/new/page.tsx`
- **Route / Component**: `/dashboard/crm/hr/timesheets/new`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/hr/timesheets/new`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr/timesheets/page.tsx`
- **Route / Component**: `/dashboard/crm/hr/timesheets`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/hr/timesheets`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr/training/[id]/edit/page.tsx`
- **Route / Component**: `/dashboard/crm/hr/training/[id]/edit`
- **Current Features**: Dynamically extracts route parameters (e.g., `id`) and search parameters, then redirects the request to `/dashboard/hrm/hr/training/[id]/edit` preserving the parameters. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr/training/[id]/page.tsx`
- **Route / Component**: `/dashboard/crm/hr/training/[id]`
- **Current Features**: Dynamically extracts route parameters (e.g., `id`) and search parameters, then redirects the request to `/dashboard/hrm/hr/training/[id]` preserving the parameters. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr/training/new/page.tsx`
- **Route / Component**: `/dashboard/crm/hr/training/new`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/hr/training/new`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr/training/page.tsx`
- **Route / Component**: `/dashboard/crm/hr/training`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/hr/training`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr/travel/page.tsx`
- **Route / Component**: `/dashboard/crm/hr/travel`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/hr/travel`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr/welcome-kit/page.tsx`
- **Route / Component**: `/dashboard/crm/hr/welcome-kit`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/hr/welcome-kit`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/appraisal-reviews/[id]/edit/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/appraisal-reviews/[id]/edit`
- **Current Features**: Dynamically extracts route parameters (e.g., `id`) and search parameters, then redirects the request to `/dashboard/hrm/payroll/appraisal-reviews/[id]/edit` preserving the parameters. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/appraisal-reviews/[id]/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/appraisal-reviews/[id]`
- **Current Features**: Dynamically extracts route parameters (e.g., `id`) and search parameters, then redirects the request to `/dashboard/hrm/payroll/appraisal-reviews/[id]` preserving the parameters. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/appraisal-reviews/new/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/appraisal-reviews/new`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/appraisal-reviews/new`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/appraisal-reviews/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/appraisal-reviews`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/appraisal-reviews`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/attendance/[id]/edit/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/attendance/[id]/edit`
- **Current Features**: Dynamically extracts route parameters (e.g., `id`) and search parameters, then redirects the request to `/dashboard/hrm/payroll/attendance/[id]/edit` preserving the parameters. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/attendance/[id]/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/attendance/[id]`
- **Current Features**: Dynamically extracts route parameters (e.g., `id`) and search parameters, then redirects the request to `/dashboard/hrm/payroll/attendance/[id]` preserving the parameters. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/attendance/new/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/attendance/new`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/attendance/new`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/attendance/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/attendance`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/attendance`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/departments/[id]/edit/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/departments/[id]/edit`
- **Current Features**: Dynamically extracts route parameters (e.g., `id`) and search parameters, then redirects the request to `/dashboard/hrm/payroll/departments/[id]/edit` preserving the parameters. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/departments/[id]/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/departments/[id]`
- **Current Features**: Dynamically extracts route parameters (e.g., `id`) and search parameters, then redirects the request to `/dashboard/hrm/payroll/departments/[id]` preserving the parameters. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/departments/hierarchy/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/departments/hierarchy`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/departments/hierarchy`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/departments/new/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/departments/new`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/departments/new`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/departments/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/departments`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/departments`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/designations/[id]/edit/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/designations/[id]/edit`
- **Current Features**: Dynamically extracts route parameters (e.g., `id`) and search parameters, then redirects the request to `/dashboard/hrm/payroll/designations/[id]/edit` preserving the parameters. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/designations/[id]/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/designations/[id]`
- **Current Features**: Dynamically extracts route parameters (e.g., `id`) and search parameters, then redirects the request to `/dashboard/hrm/payroll/designations/[id]` preserving the parameters. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/designations/hierarchy/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/designations/hierarchy`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/designations/hierarchy`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/designations/new/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/designations/new`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/designations/new`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/designations/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/designations`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/designations`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/employees/[id]/edit/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/employees/[id]/edit`
- **Current Features**: Dynamically maps the route parameter `[id]` to `[employeeId]`, extracts search parameters, and safely redirects to `/dashboard/hrm/payroll/employees/[employeeId]/edit`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/employees/[id]/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/employees/[id]`
- **Current Features**: Dynamically maps the route parameter `[id]` to `[employeeId]`, extracts search parameters, and safely redirects to `/dashboard/hrm/payroll/employees/[employeeId]`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/employees/documents/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/employees/documents`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/employees/documents`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/employees/emergency-contacts/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/employees/emergency-contacts`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/employees/emergency-contacts`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/employees/employee-skills/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/employees/employee-skills`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/employees/employee-skills`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/employees/leave-quotas/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/employees/leave-quotas`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/employees/leave-quotas`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/employees/new/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/employees/new`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/employees/new`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/employees/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/employees`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/employees`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/employees/skills/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/employees/skills`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/employees/skills`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/employees/teams/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/employees/teams`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/employees/teams`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/employees/visa-details/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/employees/visa-details`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/employees/visa-details`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/form-16/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/form-16`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/form-16`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/goal-setting/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/goal-setting`
- **Current Features**: Statically redirects requests to the new module path: `/dashboard/hrm/payroll/goal-setting`. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/holidays/[id]/edit/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/holidays/[id]/edit`
- **Current Features**: Dynamically extracts route parameters (e.g., `id`) and search parameters, then redirects the request to `/dashboard/hrm/payroll/holidays/[id]/edit` preserving the parameters. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

## `src/app/dashboard/crm/hr-payroll/holidays/[id]/page.tsx`
- **Route / Component**: `/dashboard/crm/hr-payroll/holidays/[id]`
- **Current Features**: Dynamically extracts route parameters (e.g., `id`) and search parameters, then redirects the request to `/dashboard/hrm/payroll/holidays/[id]` preserving the parameters. Acts as a legacy compatibility stub for users with old bookmarks or lingering internal links.
- **Possible Features**: None required. This is a redirect stub.
- **Errors**: No critical bugs or hydration errors. URL and search parameters are properly encoded to prevent injection.
- **Enhancement Plan**: Consider moving all such legacy route redirects to `next.config.js` or a centralized middleware to reduce the bundle size and improve routing performance.

