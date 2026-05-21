/**
 * Email notification event catalog.
 *
 * Each entry defines the default subject + HTML body template for an event
 * that SabNode emits over email. Admins can override the subject / body per
 * tenant via the settings UI — see `getEffectiveTemplate` in `./render.ts`
 * for resolution.
 *
 * Template syntax: `{{variable}}` Mustache-style substitution. No logic,
 * no conditionals — keep templates simple so non-developers can edit them.
 */

export type EmailEventCategory =
    | 'finance'
    | 'hr'
    | 'crm'
    | 'tickets'
    | 'projects'
    | 'tasks'
    | 'general';

export interface EmailTemplateVariable {
    /** Variable key — appears inside `{{...}}` in the template. */
    key: string;
    /** Human-readable description shown in the variable chip tooltip. */
    description: string;
    /** Example value used by the preview pane. */
    example: string;
}

export interface EmailTemplateEvent {
    /** Stable identifier — used as the lookup key in DB overrides. */
    key: string;
    /** Display name shown in the admin UI. */
    label: string;
    /** Grouping in the left rail. */
    category: EmailEventCategory;
    /** One-sentence description shown in the editor header. */
    description: string;
    /** Default email subject (supports `{{var}}` substitution). */
    defaultSubject: string;
    /** Default email HTML body (supports `{{var}}` substitution). */
    defaultBody: string;
    /** Variables available to this event. */
    variables: EmailTemplateVariable[];
}

export const EMAIL_EVENT_CATEGORIES: Array<{
    key: EmailEventCategory;
    label: string;
}> = [
    { key: 'finance', label: 'Finance' },
    { key: 'crm', label: 'CRM' },
    { key: 'hr', label: 'HR' },
    { key: 'tickets', label: 'Tickets' },
    { key: 'projects', label: 'Projects' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'general', label: 'General' },
];

/* ─── Shared variable fragments ─────────────────────────────────────────── */

const COMPANY_VAR: EmailTemplateVariable = {
    key: 'companyName',
    description: 'Your company / workspace name.',
    example: 'Acme Inc.',
};

const RECIPIENT_VAR: EmailTemplateVariable = {
    key: 'recipientName',
    description: 'Recipient full name.',
    example: 'Jordan Lee',
};

/* ─── Event catalog ─────────────────────────────────────────────────────── */

export const EMAIL_EVENTS: EmailTemplateEvent[] = [
    /* ── Finance ─────────────────────────────────────────────────────── */
    {
        key: 'invoice_sent',
        label: 'Invoice Sent to Client',
        category: 'finance',
        description: 'Sent when an invoice is emailed to the client.',
        defaultSubject: 'Invoice {{invoiceNumber}} from {{companyName}}',
        defaultBody:
            '<p>Hi {{clientName}},</p>' +
            '<p>Your invoice <strong>#{{invoiceNumber}}</strong> for <strong>{{totalAmount}}</strong> is due on <strong>{{dueDate}}</strong>.</p>' +
            '<p><a href="{{invoiceUrl}}">View &amp; pay invoice</a></p>' +
            '<p>Thanks,<br/>{{companyName}}</p>',
        variables: [
            { key: 'clientName', description: 'Client full name', example: 'Acme Corp' },
            { key: 'invoiceNumber', description: 'Invoice number', example: 'INV-2026-001' },
            { key: 'totalAmount', description: 'Formatted total', example: '$1,234.00' },
            { key: 'dueDate', description: 'Formatted due date', example: '2026-06-15' },
            { key: 'invoiceUrl', description: 'Public payment URL', example: 'https://app.sabnode.com/share/invoice/abc123' },
            COMPANY_VAR,
        ],
    },
    {
        key: 'payment_received',
        label: 'Payment Received',
        category: 'finance',
        description: 'Confirmation sent to the client after a payment posts.',
        defaultSubject: 'Payment received for invoice {{invoiceNumber}}',
        defaultBody:
            '<p>Hi {{clientName}},</p>' +
            '<p>We received your payment of <strong>{{amountPaid}}</strong> on {{paymentDate}} for invoice <strong>#{{invoiceNumber}}</strong>. Thank you!</p>' +
            '<p><a href="{{receiptUrl}}">Download receipt</a></p>' +
            '<p>— {{companyName}}</p>',
        variables: [
            { key: 'clientName', description: 'Client full name', example: 'Acme Corp' },
            { key: 'invoiceNumber', description: 'Invoice number', example: 'INV-2026-001' },
            { key: 'amountPaid', description: 'Formatted amount paid', example: '$1,234.00' },
            { key: 'paymentDate', description: 'Payment date', example: '2026-06-12' },
            { key: 'receiptUrl', description: 'Public receipt URL', example: 'https://app.sabnode.com/share/receipt/xyz' },
            COMPANY_VAR,
        ],
    },
    {
        key: 'payment_reminder',
        label: 'Payment Reminder',
        category: 'finance',
        description: 'Polite reminder sent before / after the invoice due date.',
        defaultSubject: 'Reminder: invoice {{invoiceNumber}} is due {{dueDate}}',
        defaultBody:
            '<p>Hi {{clientName}},</p>' +
            '<p>This is a friendly reminder that invoice <strong>#{{invoiceNumber}}</strong> for <strong>{{totalAmount}}</strong> is due on <strong>{{dueDate}}</strong> ({{daysUntilDue}} days).</p>' +
            '<p><a href="{{invoiceUrl}}">Pay now</a></p>' +
            '<p>Thanks,<br/>{{companyName}}</p>',
        variables: [
            { key: 'clientName', description: 'Client full name', example: 'Acme Corp' },
            { key: 'invoiceNumber', description: 'Invoice number', example: 'INV-2026-001' },
            { key: 'totalAmount', description: 'Formatted total', example: '$1,234.00' },
            { key: 'dueDate', description: 'Due date', example: '2026-06-15' },
            { key: 'daysUntilDue', description: 'Days until / past due', example: '3' },
            { key: 'invoiceUrl', description: 'Public payment URL', example: 'https://app.sabnode.com/share/invoice/abc' },
            COMPANY_VAR,
        ],
    },
    {
        key: 'estimate_sent',
        label: 'Estimate Sent',
        category: 'finance',
        description: 'Sent to the client when a quote / estimate is shared.',
        defaultSubject: 'Estimate {{estimateNumber}} from {{companyName}}',
        defaultBody:
            '<p>Hi {{clientName}},</p>' +
            '<p>Please find your estimate <strong>#{{estimateNumber}}</strong> for <strong>{{totalAmount}}</strong>, valid until <strong>{{expiryDate}}</strong>.</p>' +
            '<p><a href="{{estimateUrl}}">View estimate</a></p>' +
            '<p>— {{companyName}}</p>',
        variables: [
            { key: 'clientName', description: 'Client full name', example: 'Acme Corp' },
            { key: 'estimateNumber', description: 'Estimate number', example: 'EST-2026-014' },
            { key: 'totalAmount', description: 'Formatted total', example: '$5,400.00' },
            { key: 'expiryDate', description: 'Estimate expiry date', example: '2026-06-30' },
            { key: 'estimateUrl', description: 'Public estimate URL', example: 'https://app.sabnode.com/share/estimate/abc' },
            COMPANY_VAR,
        ],
    },
    {
        key: 'estimate_accepted',
        label: 'Estimate Accepted',
        category: 'finance',
        description: 'Internal notification when a client accepts an estimate.',
        defaultSubject: '{{clientName}} accepted estimate {{estimateNumber}}',
        defaultBody:
            '<p>Hi {{recipientName}},</p>' +
            '<p><strong>{{clientName}}</strong> just accepted estimate <strong>#{{estimateNumber}}</strong> ({{totalAmount}}).</p>' +
            '<p><a href="{{estimateUrl}}">Open estimate</a></p>',
        variables: [
            RECIPIENT_VAR,
            { key: 'clientName', description: 'Client name', example: 'Acme Corp' },
            { key: 'estimateNumber', description: 'Estimate number', example: 'EST-2026-014' },
            { key: 'totalAmount', description: 'Total amount', example: '$5,400.00' },
            { key: 'estimateUrl', description: 'Internal estimate URL', example: 'https://app.sabnode.com/dashboard/crm/estimates/abc' },
        ],
    },
    {
        key: 'proposal_sent',
        label: 'Proposal Sent',
        category: 'finance',
        description: 'Sent to the client when a sales proposal is shared.',
        defaultSubject: 'Proposal: {{proposalTitle}}',
        defaultBody:
            '<p>Hi {{clientName}},</p>' +
            '<p>Please review our proposal "<strong>{{proposalTitle}}</strong>". It is valid until <strong>{{expiryDate}}</strong>.</p>' +
            '<p><a href="{{proposalUrl}}">View proposal</a></p>' +
            '<p>— {{companyName}}</p>',
        variables: [
            { key: 'clientName', description: 'Client name', example: 'Acme Corp' },
            { key: 'proposalTitle', description: 'Proposal title', example: 'Q3 Marketing Engagement' },
            { key: 'expiryDate', description: 'Valid until', example: '2026-07-15' },
            { key: 'proposalUrl', description: 'Public proposal URL', example: 'https://app.sabnode.com/share/proposal/abc' },
            COMPANY_VAR,
        ],
    },
    {
        key: 'contract_signed',
        label: 'Contract Signed',
        category: 'finance',
        description: 'Confirmation when a contract is fully signed.',
        defaultSubject: 'Contract "{{contractTitle}}" has been signed',
        defaultBody:
            '<p>Hi {{recipientName}},</p>' +
            '<p>The contract <strong>"{{contractTitle}}"</strong> with <strong>{{clientName}}</strong> was signed on {{signedDate}}.</p>' +
            '<p><a href="{{contractUrl}}">View signed contract</a></p>',
        variables: [
            RECIPIENT_VAR,
            { key: 'contractTitle', description: 'Contract title', example: 'Master Services Agreement' },
            { key: 'clientName', description: 'Client name', example: 'Acme Corp' },
            { key: 'signedDate', description: 'Signed date', example: '2026-05-21' },
            { key: 'contractUrl', description: 'Contract URL', example: 'https://app.sabnode.com/dashboard/crm/contracts/abc' },
        ],
    },

    /* ── CRM ─────────────────────────────────────────────────────────── */
    {
        key: 'deal_won',
        label: 'Deal Won',
        category: 'crm',
        description: 'Internal celebration when a deal moves to Won.',
        defaultSubject: 'Deal won: {{dealName}} ({{dealAmount}})',
        defaultBody:
            '<p>Congrats {{ownerName}}!</p>' +
            '<p>The deal <strong>{{dealName}}</strong> with <strong>{{clientName}}</strong> was just won — <strong>{{dealAmount}}</strong>.</p>' +
            '<p><a href="{{dealUrl}}">Open deal</a></p>',
        variables: [
            { key: 'ownerName', description: 'Deal owner name', example: 'Jordan Lee' },
            { key: 'dealName', description: 'Deal name', example: 'Q3 Renewal — Acme' },
            { key: 'clientName', description: 'Client name', example: 'Acme Corp' },
            { key: 'dealAmount', description: 'Deal amount', example: '$24,000.00' },
            { key: 'dealUrl', description: 'Internal deal URL', example: 'https://app.sabnode.com/dashboard/crm/deals/abc' },
        ],
    },
    {
        key: 'follow_up_reminder',
        label: 'Follow-up Reminder',
        category: 'crm',
        description: 'Reminds an owner to follow up with a lead / contact.',
        defaultSubject: 'Follow up with {{contactName}} today',
        defaultBody:
            '<p>Hi {{ownerName}},</p>' +
            '<p>Time to follow up with <strong>{{contactName}}</strong> ({{companyName}}). Last contacted: {{lastContactedAt}}.</p>' +
            '<p><a href="{{contactUrl}}">Open contact</a></p>',
        variables: [
            { key: 'ownerName', description: 'Owner name', example: 'Jordan Lee' },
            { key: 'contactName', description: 'Contact name', example: 'Sam Patel' },
            { key: 'companyName', description: 'Contact company', example: 'Acme Corp' },
            { key: 'lastContactedAt', description: 'Last contacted date', example: '2026-05-10' },
            { key: 'contactUrl', description: 'Contact URL', example: 'https://app.sabnode.com/dashboard/crm/contacts/abc' },
        ],
    },

    /* ── HR ──────────────────────────────────────────────────────────── */
    {
        key: 'leave_applied',
        label: 'Leave Applied',
        category: 'hr',
        description: 'Sent to managers when an employee submits a leave request.',
        defaultSubject: '{{employeeName}} applied for {{leaveType}} leave',
        defaultBody:
            '<p>Hi {{managerName}},</p>' +
            '<p><strong>{{employeeName}}</strong> has applied for <strong>{{leaveType}}</strong> leave from <strong>{{fromDate}}</strong> to <strong>{{toDate}}</strong> ({{durationDays}} day(s)).</p>' +
            '<p>Reason: {{reason}}</p>' +
            '<p><a href="{{approvalUrl}}">Review &amp; approve</a></p>',
        variables: [
            { key: 'managerName', description: 'Manager name', example: 'Riley Chen' },
            { key: 'employeeName', description: 'Employee name', example: 'Jordan Lee' },
            { key: 'leaveType', description: 'Leave type', example: 'Casual' },
            { key: 'fromDate', description: 'Leave start date', example: '2026-06-01' },
            { key: 'toDate', description: 'Leave end date', example: '2026-06-03' },
            { key: 'durationDays', description: 'Number of days', example: '3' },
            { key: 'reason', description: 'Reason for leave', example: 'Family event' },
            { key: 'approvalUrl', description: 'Approval URL', example: 'https://app.sabnode.com/dashboard/hrm/leaves/abc' },
        ],
    },
    {
        key: 'leave_approved',
        label: 'Leave Approved',
        category: 'hr',
        description: 'Sent to the employee when their leave is approved.',
        defaultSubject: 'Your {{leaveType}} leave has been approved',
        defaultBody:
            '<p>Hi {{employeeName}},</p>' +
            '<p>Your <strong>{{leaveType}}</strong> leave from <strong>{{fromDate}}</strong> to <strong>{{toDate}}</strong> has been approved by {{managerName}}.</p>' +
            '<p>Enjoy your time off!<br/>{{companyName}}</p>',
        variables: [
            { key: 'employeeName', description: 'Employee name', example: 'Jordan Lee' },
            { key: 'leaveType', description: 'Leave type', example: 'Casual' },
            { key: 'fromDate', description: 'Leave start date', example: '2026-06-01' },
            { key: 'toDate', description: 'Leave end date', example: '2026-06-03' },
            { key: 'managerName', description: 'Approver name', example: 'Riley Chen' },
            COMPANY_VAR,
        ],
    },
    {
        key: 'leave_rejected',
        label: 'Leave Rejected',
        category: 'hr',
        description: 'Sent to the employee when their leave is rejected.',
        defaultSubject: 'Your {{leaveType}} leave request was declined',
        defaultBody:
            '<p>Hi {{employeeName}},</p>' +
            '<p>Your <strong>{{leaveType}}</strong> leave from <strong>{{fromDate}}</strong> to <strong>{{toDate}}</strong> was declined by {{managerName}}.</p>' +
            '<p>Note: {{rejectionReason}}</p>' +
            '<p>Please reach out to your manager for next steps.</p>',
        variables: [
            { key: 'employeeName', description: 'Employee name', example: 'Jordan Lee' },
            { key: 'leaveType', description: 'Leave type', example: 'Casual' },
            { key: 'fromDate', description: 'Leave start date', example: '2026-06-01' },
            { key: 'toDate', description: 'Leave end date', example: '2026-06-03' },
            { key: 'managerName', description: 'Manager name', example: 'Riley Chen' },
            { key: 'rejectionReason', description: 'Manager note', example: 'Coverage gap during this window.' },
        ],
    },
    {
        key: 'employee_birthday',
        label: 'Employee Birthday',
        category: 'hr',
        description: 'Wishes sent to the team on an employee birthday.',
        defaultSubject: 'Happy birthday, {{employeeName}}!',
        defaultBody:
            '<p>The whole team at <strong>{{companyName}}</strong> wishes <strong>{{employeeName}}</strong> a fantastic birthday today.</p>' +
            '<p>Make sure to drop a note in #celebrations!</p>',
        variables: [
            { key: 'employeeName', description: 'Employee name', example: 'Jordan Lee' },
            COMPANY_VAR,
        ],
    },
    {
        key: 'work_anniversary',
        label: 'Work Anniversary',
        category: 'hr',
        description: 'Sent on an employee work anniversary.',
        defaultSubject: '{{yearsOfService}} years at {{companyName}} — congrats {{employeeName}}!',
        defaultBody:
            '<p>Hi {{employeeName}},</p>' +
            '<p>Today marks <strong>{{yearsOfService}} year(s)</strong> since you joined <strong>{{companyName}}</strong>. Thank you for everything you do.</p>',
        variables: [
            { key: 'employeeName', description: 'Employee name', example: 'Jordan Lee' },
            { key: 'yearsOfService', description: 'Years of service', example: '3' },
            COMPANY_VAR,
        ],
    },

    /* ── Tickets ─────────────────────────────────────────────────────── */
    {
        key: 'ticket_created',
        label: 'Ticket Created',
        category: 'tickets',
        description: 'Confirmation sent when a support ticket is created.',
        defaultSubject: 'Ticket #{{ticketNumber}} received: {{ticketSubject}}',
        defaultBody:
            '<p>Hi {{contactName}},</p>' +
            '<p>We received your request — ticket <strong>#{{ticketNumber}}</strong>: <em>{{ticketSubject}}</em>.</p>' +
            '<p>Our team will reply soon. You can track progress here:</p>' +
            '<p><a href="{{ticketUrl}}">View ticket</a></p>' +
            '<p>— {{companyName}}</p>',
        variables: [
            { key: 'contactName', description: 'Customer name', example: 'Sam Patel' },
            { key: 'ticketNumber', description: 'Ticket number', example: 'T-2014' },
            { key: 'ticketSubject', description: 'Ticket subject', example: 'Cannot export CSV' },
            { key: 'ticketUrl', description: 'Public ticket URL', example: 'https://app.sabnode.com/share/ticket/abc' },
            COMPANY_VAR,
        ],
    },
    {
        key: 'ticket_replied',
        label: 'Ticket Replied',
        category: 'tickets',
        description: 'Sent when an agent posts a reply on a ticket.',
        defaultSubject: 'Re: ticket #{{ticketNumber}} — {{ticketSubject}}',
        defaultBody:
            '<p>Hi {{contactName}},</p>' +
            '<p><strong>{{agentName}}</strong> just replied to your ticket:</p>' +
            '<blockquote>{{replyExcerpt}}</blockquote>' +
            '<p><a href="{{ticketUrl}}">View full conversation</a></p>',
        variables: [
            { key: 'contactName', description: 'Customer name', example: 'Sam Patel' },
            { key: 'agentName', description: 'Agent name', example: 'Riley Chen' },
            { key: 'ticketNumber', description: 'Ticket number', example: 'T-2014' },
            { key: 'ticketSubject', description: 'Ticket subject', example: 'Cannot export CSV' },
            { key: 'replyExcerpt', description: 'First lines of the reply', example: 'Thanks for the details — try clicking…' },
            { key: 'ticketUrl', description: 'Ticket URL', example: 'https://app.sabnode.com/share/ticket/abc' },
        ],
    },

    /* ── Projects ────────────────────────────────────────────────────── */
    {
        key: 'project_deadline',
        label: 'Project Deadline Approaching',
        category: 'projects',
        description: 'Sent to the project owner before a project deadline.',
        defaultSubject: 'Project "{{projectName}}" is due {{dueDate}}',
        defaultBody:
            '<p>Hi {{ownerName}},</p>' +
            '<p>The project <strong>{{projectName}}</strong> is due in <strong>{{daysUntilDue}}</strong> day(s) — {{dueDate}}.</p>' +
            '<p>Open tasks: {{openTasksCount}}</p>' +
            '<p><a href="{{projectUrl}}">Open project</a></p>',
        variables: [
            { key: 'ownerName', description: 'Project owner', example: 'Jordan Lee' },
            { key: 'projectName', description: 'Project name', example: 'Website Refresh' },
            { key: 'dueDate', description: 'Project due date', example: '2026-06-15' },
            { key: 'daysUntilDue', description: 'Days until due', example: '5' },
            { key: 'openTasksCount', description: 'Open task count', example: '7' },
            { key: 'projectUrl', description: 'Project URL', example: 'https://app.sabnode.com/dashboard/crm/projects/abc' },
        ],
    },

    /* ── Tasks ───────────────────────────────────────────────────────── */
    {
        key: 'task_assigned',
        label: 'Task Assigned',
        category: 'tasks',
        description: 'Sent to the assignee when a task is assigned to them.',
        defaultSubject: '{{assignerName}} assigned you a task: {{taskTitle}}',
        defaultBody:
            '<p>Hi {{assigneeName}},</p>' +
            '<p><strong>{{assignerName}}</strong> assigned you a new task:</p>' +
            '<p><strong>{{taskTitle}}</strong><br/>Due: {{dueDate}}</p>' +
            '<p><a href="{{taskUrl}}">Open task</a></p>',
        variables: [
            { key: 'assigneeName', description: 'Assignee name', example: 'Jordan Lee' },
            { key: 'assignerName', description: 'Assigner name', example: 'Riley Chen' },
            { key: 'taskTitle', description: 'Task title', example: 'Draft launch announcement' },
            { key: 'dueDate', description: 'Task due date', example: '2026-05-28' },
            { key: 'taskUrl', description: 'Task URL', example: 'https://app.sabnode.com/dashboard/crm/tasks/abc' },
        ],
    },
    {
        key: 'task_completed',
        label: 'Task Completed',
        category: 'tasks',
        description: 'Notifies the task owner when a task is marked complete.',
        defaultSubject: 'Task completed: {{taskTitle}}',
        defaultBody:
            '<p>Hi {{ownerName}},</p>' +
            '<p><strong>{{completedBy}}</strong> just completed the task <strong>{{taskTitle}}</strong>.</p>' +
            '<p><a href="{{taskUrl}}">View task</a></p>',
        variables: [
            { key: 'ownerName', description: 'Task owner', example: 'Jordan Lee' },
            { key: 'completedBy', description: 'Completed by', example: 'Riley Chen' },
            { key: 'taskTitle', description: 'Task title', example: 'Draft launch announcement' },
            { key: 'taskUrl', description: 'Task URL', example: 'https://app.sabnode.com/dashboard/crm/tasks/abc' },
        ],
    },
    {
        key: 'task_reminder',
        label: 'Task Reminder',
        category: 'tasks',
        description: 'Reminder before a task due date.',
        defaultSubject: 'Reminder: "{{taskTitle}}" is due {{dueDate}}',
        defaultBody:
            '<p>Hi {{assigneeName}},</p>' +
            '<p>Your task <strong>{{taskTitle}}</strong> is due on <strong>{{dueDate}}</strong> ({{hoursUntilDue}} hrs).</p>' +
            '<p><a href="{{taskUrl}}">Open task</a></p>',
        variables: [
            { key: 'assigneeName', description: 'Assignee name', example: 'Jordan Lee' },
            { key: 'taskTitle', description: 'Task title', example: 'Draft launch announcement' },
            { key: 'dueDate', description: 'Due date', example: '2026-05-28' },
            { key: 'hoursUntilDue', description: 'Hours until due', example: '12' },
            { key: 'taskUrl', description: 'Task URL', example: 'https://app.sabnode.com/dashboard/crm/tasks/abc' },
        ],
    },
];

/** Lookup helper. Returns `undefined` when the key is unknown. */
export function findEmailEvent(key: string): EmailTemplateEvent | undefined {
    return EMAIL_EVENTS.find((e) => e.key === key);
}

/** Returns the events for a given category. */
export function eventsByCategory(
    category: EmailEventCategory,
): EmailTemplateEvent[] {
    return EMAIL_EVENTS.filter((e) => e.category === category);
}
