/**
 * Catch-all CRM specs — every Rust crate not already covered by the
 * other `crm-*.ts` module files. Standard CRUD via `crudResource` so the
 * file stays terse despite the breadth.
 *
 * If a resource needs custom verbs (e.g. send/approve/cancel), promote
 * its specs out of this file into a dedicated module so the customisations
 * stay together.
 */

import type { EndpointSpec } from '../types';
import { crudResource } from '../crud-template';

const c = (
  resource: string,
  basePath: string,
  rustPath: string,
  scopeFamily: string,
  options: Partial<{ idParam: string; display: string; tier: 'FREE' | 'PRO' | 'ENTERPRISE' }> = {},
): EndpointSpec[] =>
  crudResource({
    module: 'crm',
    resource,
    basePath,
    rustPath,
    scopeRead: `crm:${scopeFamily}:read`,
    scopeWrite: `crm:${scopeFamily}:write`,
    idParam: options.idParam,
    display: options.display,
    tierRead: options.tier,
    tierWrite: options.tier,
  });

export const crmExtrasEndpoints: ReadonlyArray<EndpointSpec> = [
  /* ── Support ──────────────────────────────────────────────────────────── */
  ...c('agent-groups', '/crm/agent-groups', '/v1/crm/agent-groups', 'support', { idParam: 'agentGroupId' }),
  ...c('ticket-groups', '/crm/ticket-groups', '/v1/crm/ticket-groups', 'support', { idParam: 'ticketGroupId' }),
  ...c('ticket-types', '/crm/ticket-types', '/v1/crm/ticket-types', 'support', { idParam: 'ticketTypeId' }),
  ...c('ticket-channels', '/crm/ticket-channels', '/v1/crm/ticket-channels', 'support', { idParam: 'ticketChannelId' }),
  ...c('ticket-tags', '/crm/ticket-tags', '/v1/crm/ticket-tags', 'support', { idParam: 'ticketTagId' }),
  ...c('reply-templates', '/crm/reply-templates', '/v1/crm/reply-templates', 'support', { idParam: 'replyTemplateId' }),
  ...c('issues', '/crm/issues', '/v1/crm/issues', 'support'),
  ...c('surveys', '/crm/surveys', '/v1/crm/surveys', 'support'),

  /* ── Inventory / catalog ──────────────────────────────────────────────── */
  ...c('tags', '/crm/tags', '/v1/crm/tags', 'inventory'),
  ...c('units', '/crm/units', '/v1/crm/units', 'inventory'),
  ...c('branches', '/crm/branches', '/v1/crm/branches', 'inventory'),
  ...c('vendor-types', '/crm/vendor-types', '/v1/crm/vendor-types', 'purchases', { idParam: 'vendorTypeId' }),

  /* ── Sales extras ─────────────────────────────────────────────────────── */
  ...c('proposals', '/crm/proposals', '/v1/crm/proposals', 'sales'),
  ...c('estimate-requests', '/crm/estimate-requests', '/v1/crm/estimate-requests', 'sales', { idParam: 'estimateRequestId' }),
  ...c('recurring-invoices', '/crm/recurring-invoices', '/v1/crm/recurring-invoices', 'sales', { idParam: 'recurringInvoiceId' }),
  ...c('purchases', '/crm/purchases', '/v1/crm/purchases', 'purchases'),
  ...c('purchase-leads', '/crm/purchase-leads', '/v1/crm/purchase-leads', 'purchases', { idParam: 'purchaseLeadId' }),
  ...c('bookings', '/crm/bookings', '/v1/crm/bookings', 'sales'),

  /* ── Accounting extras ────────────────────────────────────────────────── */
  ...c('bank-transactions', '/crm/bank-transactions', '/v1/crm/bank-transactions', 'accounting', { idParam: 'bankTransactionId' }),
  ...c('voucher-books', '/crm/voucher-books', '/v1/crm/voucher-books', 'accounting', { idParam: 'voucherBookId' }),
  ...c('voucher-entries', '/crm/voucher-entries', '/v1/crm/voucher-entries', 'accounting', { idParam: 'voucherEntryId' }),
  ...c('taxes', '/crm/taxes', '/v1/crm/taxes', 'accounting'),
  ...c('tds', '/crm/tds', '/v1/crm/tds', 'accounting', { idParam: 'tdsId' }),

  /* ── HR / payroll extras ──────────────────────────────────────────────── */
  ...c('hire', '/crm/hire', '/v1/crm/hire', 'hr'),
  ...c('onboarding', '/crm/onboarding', '/v1/crm/onboarding', 'hr', { idParam: 'onboardingId' }),
  ...c('offers', '/crm/offers', '/v1/crm/offers', 'hr'),
  ...c('compensation-bands', '/crm/compensation-bands', '/v1/crm/compensation-bands', 'hr', { idParam: 'compensationBandId' }),
  ...c('pf-esi', '/crm/pf-esi', '/v1/crm/pf-esi', 'accounting', { idParam: 'pfEsiId', display: 'PF / ESI records' }),
  ...c('professional-tax', '/crm/professional-tax', '/v1/crm/professional-tax', 'accounting', { idParam: 'professionalTaxId', display: 'professional-tax records' }),
  ...c('form-16', '/crm/form-16', '/v1/crm/form-16', 'hr', { idParam: 'form16Id', display: 'Form-16 records' }),
  ...c('payroll-settings', '/crm/payroll-settings', '/v1/crm/payroll-settings', 'hr', { idParam: 'payrollSettingId' }),
  ...c('shifts', '/crm/shifts', '/v1/crm/shifts', 'hr'),
  ...c('shift-rotations', '/crm/shift-rotations', '/v1/crm/shift-rotations', 'hr', { idParam: 'shiftRotationId' }),
  ...c('shift-change-requests', '/crm/shift-change-requests', '/v1/crm/shift-change-requests', 'hr', { idParam: 'shiftChangeRequestId' }),
  ...c('leave-requests', '/crm/leave-requests', '/v1/crm/leave-requests', 'hr', { idParam: 'leaveRequestId' }),
  ...c('probation', '/crm/probation', '/v1/crm/probation', 'hr', { idParam: 'probationId' }),
  ...c('notices', '/crm/notices', '/v1/crm/notices', 'hr'),
  ...c('policies', '/crm/policies', '/v1/crm/policies', 'hr'),
  ...c('recognitions', '/crm/recognitions', '/v1/crm/recognitions', 'hr'),
  ...c('feedback-360', '/crm/feedback-360', '/v1/crm/feedback-360', 'hr', { idParam: 'feedback360Id', display: '360-degree feedback' }),
  ...c('learning-paths', '/crm/learning-paths', '/v1/crm/learning-paths', 'hr', { idParam: 'learningPathId' }),
  ...c('certifications', '/crm/certifications', '/v1/crm/certifications', 'hr'),
  ...c('training', '/crm/training', '/v1/crm/training', 'hr'),
  ...c('travel', '/crm/travel', '/v1/crm/travel', 'hr', { idParam: 'travelId' }),
  ...c('expense-claims', '/crm/expense-claims', '/v1/crm/expense-claims', 'accounting', { idParam: 'expenseClaimId' }),
  ...c('expense-categories', '/crm/expense-categories', '/v1/crm/expense-categories', 'accounting', { idParam: 'expenseCategoryId' }),
  ...c('roles', '/crm/roles', '/v1/crm/roles', 'settings'),
  ...c('settings', '/crm/settings', '/v1/crm/settings', 'settings', { idParam: 'settingId' }),
  ...c('industries', '/crm/industries', '/v1/crm/industries', 'settings'),
  ...c('company-profile', '/crm/company-profile', '/v1/crm/company-profile', 'settings', { idParam: 'companyProfileId' }),

  /* ── Assets / documents ───────────────────────────────────────────────── */
  ...c('assets', '/crm/assets', '/v1/crm/assets', 'inventory'),
  ...c('asset-assignments', '/crm/asset-assignments', '/v1/crm/asset-assignments', 'inventory', { idParam: 'assetAssignmentId' }),
  ...c('documents', '/crm/documents', '/v1/crm/documents', 'content'),
  ...c('document-templates', '/crm/document-templates', '/v1/crm/document-templates', 'content', { idParam: 'documentTemplateId' }),
  ...c('email-templates', '/crm/email-templates', '/v1/crm/email-templates', 'content', { idParam: 'emailTemplateId' }),

  /* ── Projects / tasks extras ──────────────────────────────────────────── */
  ...c('project-categories', '/crm/project-categories', '/v1/crm/project-categories', 'projects', { idParam: 'projectCategoryId' }),
  ...c('project-tasks', '/crm/project-tasks', '/v1/crm/project-tasks', 'projects', { idParam: 'projectTaskId' }),
  ...c('subtasks', '/crm/subtasks', '/v1/crm/subtasks', 'projects'),
  ...c('milestones', '/crm/milestones', '/v1/crm/milestones', 'projects'),
  ...c('events', '/crm/events', '/v1/crm/events', 'projects'),
  ...c('task-labels', '/crm/task-labels', '/v1/crm/task-labels', 'projects', { idParam: 'taskLabelId' }),
  ...c('task-tags', '/crm/task-tags', '/v1/crm/task-tags', 'projects', { idParam: 'taskTagId' }),
  ...c('task-categories', '/crm/task-categories', '/v1/crm/task-categories', 'projects', { idParam: 'taskCategoryId' }),
  ...c('taskboard-columns', '/crm/taskboard-columns', '/v1/crm/taskboard-columns', 'projects', { idParam: 'taskboardColumnId' }),
  ...c('time-logs', '/crm/time-logs', '/v1/crm/time-logs', 'projects', { idParam: 'timeLogId' }),

  /* ── Marketing / automation ───────────────────────────────────────────── */
  ...c('automations', '/crm/automations', '/v1/crm/automations', 'marketing'),
  ...c('auto-lead-rules', '/crm/auto-lead-rules', '/v1/crm/auto-lead-rules', 'marketing', { idParam: 'autoLeadRuleId' }),
];
