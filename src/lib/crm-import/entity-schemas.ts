/**
 * Entity schemas for the generic CRM Excel/CSV import wizard at
 * `/dashboard/crm/import-export`.
 *
 * Each entry defines the canonical field list for an importable
 * entity (employees, clients, leads, deals, products, expenses,
 * attendance), the Mongo collection it lands in, the validation rules
 * for each field, and an optional `prepareForInsert` hook that lets
 * the importer shape the row into its final on-disk doc.
 *
 * The wizard reads `ENTITY_SCHEMAS` to:
 *   • populate the entity-picker dropdown
 *   • render the column-mapping table
 *   • validate each row before insert
 *   • build the final insert payload (with `userId` + `createdAt`)
 *
 * Adding a new entity is a one-file change here — the wizard, action,
 * and error-CSV route pick it up automatically.
 */

import { ObjectId } from 'mongodb';

export type ImportFieldType =
    | 'string'
    | 'number'
    | 'date'
    | 'email'
    | 'phone'
    | 'enum'
    | 'boolean';

export interface ImportField {
    /** DB field name (the canonical name that flows to Mongo). */
    name: string;
    /** Human-friendly label shown in the wizard. */
    label: string;
    /** If true, the column must be mapped AND the cell must be non-empty. */
    required?: boolean;
    /** Validation + coercion type. */
    type: ImportFieldType;
    /** For `type: 'enum'`, the allowed values. Case-insensitive match. */
    enumValues?: string[];
    /** Optional per-field value transformer (raw string → coerced value). */
    transform?: (raw: string) => unknown;
    /** Example value rendered as placeholder in the mapping UI. */
    example?: string;
}

export interface EntitySchema {
    entityType: string;
    label: string;
    description: string;
    collection: string;
    fields: ImportField[];
    /**
     * Whole-row validation hook. Return `null` if the row is OK, or an
     * error message string explaining what's wrong.
     */
    validate?: (row: Record<string, unknown>) => string | null;
    /**
     * Build the final insert doc. Defaults to a shallow copy of `row`
     * plus `userId` + `createdAt` if not provided.
     */
    prepareForInsert?: (
        row: Record<string, unknown>,
        userId: string,
    ) => Record<string, unknown>;
}

/* ─── shared coercion helpers ─────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s\-()]{6,}$/;

export function coerceCell(
    raw: unknown,
    field: ImportField,
): { ok: true; value: unknown } | { ok: false; error: string } {
    const str = raw === null || raw === undefined ? '' : String(raw).trim();
    if (str.length === 0) {
        if (field.required) return { ok: false, error: `Missing "${field.label}"` };
        return { ok: true, value: undefined };
    }
    if (field.transform) {
        try {
            return { ok: true, value: field.transform(str) };
        } catch (e) {
            return {
                ok: false,
                error: `Bad value for "${field.label}": ${(e as Error).message}`,
            };
        }
    }
    switch (field.type) {
        case 'string':
            return { ok: true, value: str };
        case 'number': {
            const n = Number(str.replace(/,/g, ''));
            if (!Number.isFinite(n)) {
                return { ok: false, error: `"${field.label}" must be a number` };
            }
            return { ok: true, value: n };
        }
        case 'date': {
            const d = new Date(str);
            if (Number.isNaN(d.getTime())) {
                return { ok: false, error: `"${field.label}" must be a valid date` };
            }
            return { ok: true, value: d };
        }
        case 'email': {
            const lower = str.toLowerCase();
            if (!EMAIL_RE.test(lower)) {
                return { ok: false, error: `"${field.label}" must be a valid email` };
            }
            return { ok: true, value: lower };
        }
        case 'phone': {
            if (!PHONE_RE.test(str)) {
                return { ok: false, error: `"${field.label}" must be a valid phone` };
            }
            return { ok: true, value: str };
        }
        case 'enum': {
            const allowed = field.enumValues ?? [];
            const match = allowed.find((a) => a.toLowerCase() === str.toLowerCase());
            if (!match) {
                return {
                    ok: false,
                    error: `"${field.label}" must be one of: ${allowed.join(', ')}`,
                };
            }
            return { ok: true, value: match };
        }
        case 'boolean': {
            const truthy = ['true', 'yes', '1', 'y'];
            const falsy = ['false', 'no', '0', 'n'];
            const lc = str.toLowerCase();
            if (truthy.includes(lc)) return { ok: true, value: true };
            if (falsy.includes(lc)) return { ok: true, value: false };
            return { ok: false, error: `"${field.label}" must be true/false` };
        }
        default:
            return { ok: true, value: str };
    }
}

function defaultPrepareForInsert(
    row: Record<string, unknown>,
    userId: string,
): Record<string, unknown> {
    return {
        ...row,
        userId: new ObjectId(userId),
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

/* ─── entity definitions ──────────────────────────────────────────── */

export const ENTITY_SCHEMAS: Record<string, EntitySchema> = {
    employees: {
        entityType: 'employees',
        label: 'Employees',
        description: 'HR employees — name, contact, department, role, joining date.',
        collection: 'crm_employees',
        fields: [
            { name: 'firstName', label: 'First name', required: true, type: 'string', example: 'Aanya' },
            { name: 'lastName', label: 'Last name', required: true, type: 'string', example: 'Sharma' },
            { name: 'email', label: 'Email', required: true, type: 'email', example: 'aanya@acme.com' },
            { name: 'employeeId', label: 'Employee ID', type: 'string', example: 'EMP-1024' },
            { name: 'departmentName', label: 'Department', type: 'string', example: 'Engineering' },
            { name: 'designation', label: 'Designation', type: 'string', example: 'Senior Engineer' },
            { name: 'joiningDate', label: 'Joining date', type: 'date', example: '2024-02-15' },
            { name: 'mobile', label: 'Mobile', type: 'phone', example: '+919876543210' },
            { name: 'gender', label: 'Gender', type: 'enum', enumValues: ['Male', 'Female', 'Other'] },
            { name: 'status', label: 'Status', type: 'enum', enumValues: ['Active', 'Inactive', 'On Leave'], example: 'Active' },
            { name: 'grossSalary', label: 'Gross salary', type: 'number', example: '850000' },
        ],
        prepareForInsert(row, userId) {
            const out: Record<string, unknown> = defaultPrepareForInsert(row, userId);
            if (!out['status']) out['status'] = 'Active';
            return out;
        },
    },

    clients: {
        entityType: 'clients',
        label: 'Clients',
        description: 'Customer accounts / clients — name, contact, GST, address.',
        collection: 'crm_clients',
        fields: [
            { name: 'name', label: 'Client name', required: true, type: 'string', example: 'Acme Corp' },
            { name: 'email', label: 'Email', type: 'email', example: 'billing@acme.com' },
            { name: 'company', label: 'Company', type: 'string', example: 'Acme Corp Pvt Ltd' },
            { name: 'mobile', label: 'Mobile', type: 'phone', example: '+919812345678' },
            { name: 'gst_number', label: 'GSTIN', type: 'string', example: '27ABCDE1234F1Z5' },
            { name: 'address', label: 'Address', type: 'string', example: '12 MG Road' },
            { name: 'city', label: 'City', type: 'string', example: 'Mumbai' },
            { name: 'state', label: 'State', type: 'string', example: 'Maharashtra' },
            { name: 'country', label: 'Country', type: 'string', example: 'India' },
            { name: 'pincode', label: 'Pincode', type: 'string', example: '400001' },
            { name: 'category', label: 'Category', type: 'string', example: 'Enterprise' },
        ],
    },

    leads: {
        entityType: 'leads',
        label: 'Leads',
        description: 'Sales leads / prospects — name, contact, source, value.',
        collection: 'crm_leads',
        fields: [
            { name: 'client_name', label: 'Lead name', required: true, type: 'string', example: 'Rohan Mehta' },
            { name: 'client_email', label: 'Email', type: 'email', example: 'rohan@startup.io' },
            { name: 'company_name', label: 'Company', type: 'string', example: 'Startup IO' },
            { name: 'mobile', label: 'Mobile', type: 'phone', example: '+919811122233' },
            { name: 'source', label: 'Source', type: 'string', example: 'Website' },
            { name: 'category', label: 'Category', type: 'string', example: 'Inbound' },
            { name: 'value', label: 'Estimated value', type: 'number', example: '125000' },
            { name: 'status', label: 'Status', type: 'enum', enumValues: ['New', 'Contacted', 'Qualified', 'Lost', 'Won'], example: 'New' },
            { name: 'priority', label: 'Priority', type: 'enum', enumValues: ['Low', 'Medium', 'High'], example: 'Medium' },
            { name: 'notes', label: 'Notes', type: 'string' },
        ],
        prepareForInsert(row, userId) {
            const out = defaultPrepareForInsert(row, userId);
            if (!out['status']) out['status'] = 'New';
            return out;
        },
    },

    deals: {
        entityType: 'deals',
        label: 'Deals',
        description: 'Sales deals / opportunities — name, value, pipeline stage, owner.',
        collection: 'crm_deals',
        fields: [
            { name: 'name', label: 'Deal name', required: true, type: 'string', example: 'Acme Q2 Renewal' },
            { name: 'client_email', label: 'Client email', type: 'email', example: 'billing@acme.com' },
            { name: 'value', label: 'Deal value', required: true, type: 'number', example: '450000' },
            { name: 'currency', label: 'Currency', type: 'string', example: 'INR' },
            { name: 'pipeline', label: 'Pipeline', type: 'string', example: 'Enterprise Sales' },
            { name: 'stage', label: 'Stage', type: 'string', example: 'Proposal Sent' },
            { name: 'agent_email', label: 'Owner email', type: 'email', example: 'agent@acme.com' },
            { name: 'close_date', label: 'Expected close date', type: 'date', example: '2026-06-30' },
            { name: 'probability', label: 'Win probability (%)', type: 'number', example: '60' },
            { name: 'notes', label: 'Notes', type: 'string' },
        ],
    },

    products: {
        entityType: 'products',
        label: 'Products',
        description: 'Inventory items / services — SKU, price, category, tax.',
        collection: 'crm_products',
        fields: [
            { name: 'name', label: 'Product name', required: true, type: 'string', example: 'Pro Plan License' },
            { name: 'sku', label: 'SKU', type: 'string', example: 'PRO-LIC-001' },
            { name: 'price', label: 'Price', required: true, type: 'number', example: '4999' },
            { name: 'category', label: 'Category', type: 'string', example: 'Software' },
            { name: 'unit', label: 'Unit', type: 'string', example: 'license' },
            { name: 'tax_percent', label: 'Tax (%)', type: 'number', example: '18' },
            { name: 'hsn_code', label: 'HSN / SAC', type: 'string', example: '998314' },
            { name: 'description', label: 'Description', type: 'string' },
            { name: 'stock', label: 'Stock', type: 'number', example: '100' },
        ],
    },

    expenses: {
        entityType: 'expenses',
        label: 'Expenses',
        description: 'Accounting expenses — item, date, amount, category.',
        collection: 'crm_expenses',
        fields: [
            { name: 'item_name', label: 'Item name', required: true, type: 'string', example: 'AWS Hosting' },
            { name: 'purchase_date', label: 'Purchase date', required: true, type: 'date', example: '2026-04-30' },
            { name: 'price', label: 'Amount', required: true, type: 'number', example: '14500' },
            { name: 'category', label: 'Category', type: 'string', example: 'Infrastructure' },
            { name: 'vendor', label: 'Vendor', type: 'string', example: 'Amazon Web Services' },
            { name: 'payment_method', label: 'Payment method', type: 'string', example: 'Bank Transfer' },
            { name: 'currency', label: 'Currency', type: 'string', example: 'INR' },
            { name: 'tax_percent', label: 'Tax (%)', type: 'number', example: '18' },
            { name: 'description', label: 'Description', type: 'string' },
            { name: 'reference', label: 'Reference / invoice #', type: 'string' },
        ],
    },

    attendance: {
        entityType: 'attendance',
        label: 'Attendance',
        description: 'HR attendance records — employee, date, clock in/out, status.',
        collection: 'crm_attendance',
        fields: [
            { name: 'employee_email', label: 'Employee email', required: true, type: 'email', example: 'aanya@acme.com' },
            { name: 'date', label: 'Date', required: true, type: 'date', example: '2026-05-20' },
            { name: 'clock_in', label: 'Clock in', type: 'string', example: '09:15' },
            { name: 'clock_out', label: 'Clock out', type: 'string', example: '18:30' },
            { name: 'status', label: 'Status', type: 'enum', enumValues: ['Present', 'Absent', 'Leave', 'Half Day', 'Holiday'], example: 'Present' },
            { name: 'hours_worked', label: 'Hours worked', type: 'number', example: '8.5' },
            { name: 'overtime_hours', label: 'Overtime hours', type: 'number', example: '1' },
            { name: 'notes', label: 'Notes', type: 'string' },
        ],
        validate(row) {
            const clockIn = row['clock_in'];
            const clockOut = row['clock_out'];
            if (
                typeof clockIn === 'string' &&
                typeof clockOut === 'string' &&
                clockIn.length > 0 &&
                clockOut.length > 0 &&
                clockIn > clockOut
            ) {
                return 'Clock-in time must be before clock-out time';
            }
            return null;
        },
    },
};

export type EntityType = keyof typeof ENTITY_SCHEMAS;

export function getEntitySchema(entityType: string): EntitySchema | null {
    return ENTITY_SCHEMAS[entityType] ?? null;
}

export function listEntitySchemas(): EntitySchema[] {
    return Object.values(ENTITY_SCHEMAS);
}
