/**
 * CRM + HRM index bootstrap — run once from the project root.
 *
 *   npx ts-node scripts/create-indexes.ts
 *
 * All operations are idempotent: re-running is safe. MongoDB silently
 * skips index creation when an identical index already exists.
 *
 * Requires: MONGODB_URI and MONGODB_DB env vars (load via .env.local or
 * export them directly before running).
 */

import { connectToDatabase } from '../src/lib/mongodb';
import type { Db } from 'mongodb';

interface IndexOp {
  label: string;
  promise: Promise<string>;
}

function buildOps(db: Db): IndexOp[] {
  return [
    // ------------------------------------------------------------------ //
    // crm_employees
    // ------------------------------------------------------------------ //
    {
      label: 'crm_employees: text(firstName, lastName, email, employeeId)',
      promise: db.collection('crm_employees').createIndex(
        { firstName: 'text', lastName: 'text', email: 'text', employeeId: 'text' },
        { background: true },
      ),
    },
    {
      label: 'crm_employees: (userId, status)',
      promise: db.collection('crm_employees').createIndex(
        { userId: 1, status: 1 },
        { background: true },
      ),
    },
    {
      label: 'crm_employees: (userId, departmentId)',
      promise: db.collection('crm_employees').createIndex(
        { userId: 1, departmentId: 1 },
        { background: true },
      ),
    },
    {
      label: 'crm_employees: (userId, reportingManagerId)',
      promise: db.collection('crm_employees').createIndex(
        { userId: 1, reportingManagerId: 1 },
        { background: true },
      ),
    },

    // ------------------------------------------------------------------ //
    // crm_leads
    // ------------------------------------------------------------------ //
    {
      label: 'crm_leads: text(title, contactName, company)',
      promise: db.collection('crm_leads').createIndex(
        { title: 'text', contactName: 'text', company: 'text' },
        { background: true },
      ),
    },
    {
      label: 'crm_leads: (userId, status)',
      promise: db.collection('crm_leads').createIndex(
        { userId: 1, status: 1 },
        { background: true },
      ),
    },

    // ------------------------------------------------------------------ //
    // crm_contracts
    // ------------------------------------------------------------------ //
    {
      label: 'crm_contracts: text(title, counterparty)',
      promise: db.collection('crm_contracts').createIndex(
        { title: 'text', counterparty: 'text' },
        { background: true },
      ),
    },
    {
      label: 'crm_contracts: (userId, status, expiresAt)',
      promise: db.collection('crm_contracts').createIndex(
        { userId: 1, status: 1, expiresAt: 1 },
        { background: true },
      ),
    },

    // ------------------------------------------------------------------ //
    // crm_invoices
    // ------------------------------------------------------------------ //
    {
      label: 'crm_invoices: text(invoiceNumber, clientName)',
      promise: db.collection('crm_invoices').createIndex(
        { invoiceNumber: 'text', clientName: 'text' },
        { background: true },
      ),
    },
    {
      label: 'crm_invoices: (userId, status, dueDate)',
      promise: db.collection('crm_invoices').createIndex(
        { userId: 1, status: 1, dueDate: 1 },
        { background: true },
      ),
    },

    // ------------------------------------------------------------------ //
    // crm_tasks  (worksuite)
    // ------------------------------------------------------------------ //
    {
      label: 'crm_tasks: text(title, description)',
      promise: db.collection('crm_tasks').createIndex(
        { title: 'text', description: 'text' },
        { background: true },
      ),
    },
    {
      label: 'crm_tasks: (userId, status, assignedTo)',
      promise: db.collection('crm_tasks').createIndex(
        { userId: 1, status: 1, assignedTo: 1 },
        { background: true },
      ),
    },
    {
      label: 'crm_tasks: (userId, projectId)',
      promise: db.collection('crm_tasks').createIndex(
        { userId: 1, projectId: 1 },
        { background: true },
      ),
    },

    // ------------------------------------------------------------------ //
    // crm_projects
    // ------------------------------------------------------------------ //
    {
      label: 'crm_projects: text(name, description)',
      promise: db.collection('crm_projects').createIndex(
        { name: 'text', description: 'text' },
        { background: true },
      ),
    },
    {
      label: 'crm_projects: (userId, status)',
      promise: db.collection('crm_projects').createIndex(
        { userId: 1, status: 1 },
        { background: true },
      ),
    },

    // ------------------------------------------------------------------ //
    // crm_tickets
    // ------------------------------------------------------------------ //
    {
      label: 'crm_tickets: text(subject, description)',
      promise: db.collection('crm_tickets').createIndex(
        { subject: 'text', description: 'text' },
        { background: true },
      ),
    },
    {
      label: 'crm_tickets: (userId, status, assignedTo)',
      promise: db.collection('crm_tickets').createIndex(
        { userId: 1, status: 1, assignedTo: 1 },
        { background: true },
      ),
    },

    // ------------------------------------------------------------------ //
    // hrm_roadmaps  (HRM portal)
    // ------------------------------------------------------------------ //
    {
      label: 'hrm_roadmaps: text(title, description)',
      promise: db.collection('hrm_roadmaps').createIndex(
        { title: 'text', description: 'text' },
        { background: true },
      ),
    },
    {
      label: 'hrm_roadmaps: (userId, createdBy)',
      promise: db.collection('hrm_roadmaps').createIndex(
        { userId: 1, createdBy: 1 },
        { background: true },
      ),
    },

    // ------------------------------------------------------------------ //
    // hrm_task_reports  (HRM portal)
    // ------------------------------------------------------------------ //
    {
      label: 'hrm_task_reports: (userId, assignerId, completedAt desc)',
      promise: db.collection('hrm_task_reports').createIndex(
        { userId: 1, assignerId: 1, completedAt: -1 },
        { background: true },
      ),
    },
    {
      label: 'hrm_task_reports: (userId, workerId)',
      promise: db.collection('hrm_task_reports').createIndex(
        { userId: 1, workerId: 1 },
        { background: true },
      ),
    },

    // ------------------------------------------------------------------ //
    // hrm_permission_groups  (HRM portal)
    // ------------------------------------------------------------------ //
    {
      label: 'hrm_permission_groups: text(name)',
      promise: db.collection('hrm_permission_groups').createIndex(
        { name: 'text' },
        { background: true },
      ),
    },
    {
      label: 'hrm_permission_groups: (userId)',
      promise: db.collection('hrm_permission_groups').createIndex(
        { userId: 1 },
        { background: true },
      ),
    },

    // ------------------------------------------------------------------ //
    // crm_reply_templates
    // ------------------------------------------------------------------ //
    {
      label: 'crm_reply_templates: text(title, body)',
      promise: db.collection('crm_reply_templates').createIndex(
        { title: 'text', body: 'text' },
        { background: true },
      ),
    },
    {
      label: 'crm_reply_templates: (userId, category, isActive)',
      promise: db.collection('crm_reply_templates').createIndex(
        { userId: 1, category: 1, isActive: 1 },
        { background: true },
      ),
    },

    // ------------------------------------------------------------------ //
    // crm_assets
    // ------------------------------------------------------------------ //
    {
      label: 'crm_assets: text(name, serialNumber)',
      promise: db.collection('crm_assets').createIndex(
        { name: 'text', serialNumber: 'text' },
        { background: true },
      ),
    },
    {
      label: 'crm_assets: (userId, status)',
      promise: db.collection('crm_assets').createIndex(
        { userId: 1, status: 1 },
        { background: true },
      ),
    },
  ];
}

async function createIndexes(): Promise<void> {
  const { db } = await connectToDatabase();

  console.log('Building index operations...');
  const ops = buildOps(db);

  const results = await Promise.allSettled(ops.map((o) => o.promise));

  let failed = 0;
  results.forEach((result, i) => {
    const label = ops[i].label;
    if (result.status === 'fulfilled') {
      console.log(`  [OK] ${label}  →  ${result.value}`);
    } else {
      failed++;
      console.error(`  [FAIL] ${label}`);
      console.error(`         ${(result.reason as Error)?.message ?? result.reason}`);
    }
  });

  console.log(`\nDone. ${ops.length - failed}/${ops.length} indexes created successfully.`);

  if (failed > 0) {
    process.exit(1);
  }

  process.exit(0);
}

createIndexes().catch((e: unknown) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
