/**
 * Education vertical — schools, edtech and tutoring centres. FERPA-aware:
 * directory information is gated behind guardian consent and student data
 * cannot leave the tenant boundary.
 */

import type { Vertical } from '../types';

export const EDUCATION_VERTICAL: Vertical = {
  id: 'education',
  name: 'Education & EdTech',
  industry: 'Education',
  icon: 'graduation-cap',
  description:
    'FERPA-aware student lifecycle workspace. Inquiry → application → enrollment → ' +
    'attendance → fee collection.',
  dataModel: {
    id: 'education',
    defaultTags: ['education', 'school', 'ferpa'],
    entities: [
      {
        name: 'student',
        label: 'Students',
        fields: [
          { key: 'student_id', label: 'Student ID', type: 'string', required: true, sensitive: true },
          { key: 'first_name', label: 'First Name', type: 'string', required: true, sensitive: true },
          { key: 'last_name', label: 'Last Name', type: 'string', required: true, sensitive: true },
          { key: 'grade', label: 'Grade', type: 'string' },
          { key: 'guardian_name', label: 'Guardian Name', type: 'string', sensitive: true },
          { key: 'guardian_phone', label: 'Guardian Phone', type: 'phone', sensitive: true },
          { key: 'guardian_consent', label: 'Guardian Consent (FERPA)', type: 'boolean' },
          { key: 'address', label: 'Address', type: 'text', sensitive: true },
          { key: 'photo_url', label: 'Photo URL', type: 'url', sensitive: true },
        ],
      },
      {
        name: 'application',
        label: 'Applications',
        stages: ['inquiry', 'application_started', 'submitted', 'shortlisted', 'admitted', 'enrolled', 'rejected'],
        fields: [
          { key: 'student_id', label: 'Student', type: 'reference', ref: 'student' },
          { key: 'program', label: 'Program', type: 'string' },
          { key: 'session', label: 'Session', type: 'string' },
          { key: 'application_fee_paid', label: 'Application Fee Paid', type: 'boolean' },
          { key: 'status', label: 'Status', type: 'enum', options: ['inquiry', 'submitted', 'admitted', 'enrolled'] },
        ],
      },
      {
        name: 'fee_invoice',
        label: 'Fee Invoices',
        fields: [
          { key: 'student_id', label: 'Student', type: 'reference', ref: 'student', required: true },
          { key: 'amount', label: 'Amount', type: 'currency', required: true },
          { key: 'due_date', label: 'Due Date', type: 'date', required: true },
          { key: 'paid', label: 'Paid', type: 'boolean' },
          { key: 'payment_method', label: 'Method', type: 'enum', options: ['bank', 'upi', 'card', 'cash'] },
        ],
      },
    ],
  },
  sampleData: {
    student: [
      { student_id: 'STU-2026-001', first_name: 'Riya', last_name: 'Khan', grade: '8', guardian_name: 'Sameer Khan', guardian_phone: '+91 90000 44444', guardian_consent: true },
    ],
    application: [
      { student_id: 'sample:1', program: 'CBSE', session: '2026-27', status: 'admitted' },
    ],
    fee_invoice: [
      { student_id: 'sample:1', amount: 45000, due_date: '2026-06-01', paid: false },
    ],
  },
  baselineFlows: [
    {
      id: 'education.application-nurture',
      name: 'Application Nurture',
      description: 'Walk inquiries through the application steps with reminders.',
      trigger: 'application.created',
      steps: ['send_whatsapp:welcome', 'wait:48h', 'send_whatsapp:doc-checklist', 'wait:7d', 'send_whatsapp:nudge'],
      category: 'admissions',
    },
    {
      id: 'education.fee-reminders',
      name: 'Fee Reminders',
      description: 'Pre-due, due-day and overdue reminders for fee invoices.',
      trigger: 'fee_invoice.created',
      steps: ['wait_until:due-7d', 'send_sms:fee-prereminder', 'wait_until:due', 'send_sms:fee-due', 'wait:3d', 'send_sms:fee-overdue'],
      category: 'finance',
    },
  ],
  dashboards: [
    {
      id: 'education.admissions',
      name: 'Admissions Pulse',
      audience: 'manager',
      widgets: [
        { id: 'inquiries', type: 'kpi', title: 'Inquiries (30d)', source: 'applications.inquiries_30d', width: 3 },
        { id: 'enrolled', type: 'kpi', title: 'Enrolled (Session)', source: 'applications.enrolled_session', width: 3 },
        { id: 'conversion', type: 'kpi', title: 'Conversion Rate', source: 'applications.conversion', width: 3 },
        { id: 'fees-out', type: 'kpi', title: 'Fees Outstanding', source: 'fee_invoice.outstanding', width: 3 },
        { id: 'pipeline', type: 'funnel', title: 'Admissions Funnel', source: 'applications.funnel', width: 12 },
      ],
    },
  ],
  aiAgents: [
    {
      id: 'education.admissions-counselor',
      name: 'Admissions Counselor',
      role: 'Answer prospect questions about programs, fees and deadlines without sharing student PII.',
      tools: ['kb.programs', 'kb.fees', 'applications.create'],
    },
  ],
  complianceHooks: [
    { id: 'ferpa.student-isolation', reason: 'Student records are strictly scoped per tenant.', on: 'install' },
    { id: 'ferpa.directory-info-gate', reason: 'Withhold directory info until guardian_consent=true.', on: 'write' },
  ],
  messagingTemplates: [
    {
      id: 'education.welcome',
      channel: 'whatsapp',
      name: 'Application Welcome',
      body: 'Welcome to {{school}}, {{guardian_name}}. Here is the application checklist: {{url}}.',
      variables: ['school', 'guardian_name', 'url'],
    },
    {
      id: 'education.fee-due',
      channel: 'sms',
      name: 'Fee Due',
      body: 'Reminder: fee of {{amount}} for {{student}} is due today. Pay here: {{pay_url}}',
    },
  ],
  contractTemplates: [
    {
      id: 'education.enrollment-agreement',
      name: 'Enrollment Agreement',
      body: 'This enrollment agreement between {{school}} and {{guardian}} for the academic session {{session}}…',
      signers: ['guardian', 'school'],
      jurisdictions: ['US-FERPA'],
    },
  ],
  recommendedAddons: [
    { id: 'razorpay', reason: 'Fee collection.' },
    { id: 'google-classroom', reason: 'Roster + assignment sync.' },
  ],
};
