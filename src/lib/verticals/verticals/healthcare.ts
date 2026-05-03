/**
 * Healthcare vertical — clinics & multi-specialty practices. HIPAA gated:
 * install fails until a Business Associate Agreement is on file for the
 * tenant. PHI fields are flagged sensitive so the data fabric can encrypt
 * them at rest and the messaging hooks redact them at egress.
 */

import type { Vertical } from '../types';

export const HEALTHCARE_VERTICAL: Vertical = {
  id: 'healthcare',
  name: 'Healthcare & Clinics',
  industry: 'Healthcare',
  icon: 'stethoscope',
  description:
    'HIPAA-aware vertical for clinics. Includes appointment management, patient comms, ' +
    'consent forms and a triage AI agent.',
  dataModel: {
    id: 'healthcare',
    defaultTags: ['healthcare', 'clinic', 'hipaa'],
    entities: [
      {
        name: 'patient',
        label: 'Patients',
        fields: [
          { key: 'mrn', label: 'Medical Record #', type: 'string', required: true, sensitive: true },
          { key: 'first_name', label: 'First Name', type: 'string', required: true, sensitive: true },
          { key: 'last_name', label: 'Last Name', type: 'string', required: true, sensitive: true },
          { key: 'dob', label: 'Date of Birth', type: 'date', sensitive: true },
          { key: 'sex', label: 'Sex', type: 'enum', options: ['male', 'female', 'other', 'unknown'] },
          { key: 'phone', label: 'Phone', type: 'phone', sensitive: true },
          { key: 'allergies', label: 'Allergies', type: 'text', sensitive: true },
          { key: 'diagnosis', label: 'Active Diagnoses (ICD-10)', type: 'text', sensitive: true },
          { key: 'insurance_id', label: 'Insurance ID', type: 'string', sensitive: true },
        ],
      },
      {
        name: 'appointment',
        label: 'Appointments',
        stages: ['booked', 'confirmed', 'checked_in', 'completed', 'no_show', 'cancelled'],
        fields: [
          { key: 'patient_id', label: 'Patient', type: 'reference', ref: 'patient', required: true },
          { key: 'provider_id', label: 'Provider', type: 'reference', ref: 'provider', required: true },
          { key: 'starts_at', label: 'Start', type: 'datetime', required: true },
          { key: 'duration_min', label: 'Duration (min)', type: 'number' },
          { key: 'reason', label: 'Reason', type: 'text', sensitive: true },
          { key: 'status', label: 'Status', type: 'enum', options: ['booked', 'confirmed', 'completed', 'no_show'] },
        ],
      },
      {
        name: 'provider',
        label: 'Providers',
        fields: [
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'speciality', label: 'Speciality', type: 'string' },
          { key: 'npi', label: 'NPI', type: 'string', sensitive: true },
          { key: 'email', label: 'Email', type: 'email', sensitive: true },
        ],
      },
    ],
  },
  sampleData: {
    provider: [
      { name: 'Dr. Priya Nair', speciality: 'Internal Medicine' },
      { name: 'Dr. James Cole', speciality: 'Cardiology' },
    ],
    patient: [
      { mrn: 'MRN-001', first_name: 'Asha', last_name: 'Verma', dob: '1985-04-12', sex: 'female' },
    ],
    appointment: [
      { patient_id: 'sample:1', provider_id: 'sample:1', starts_at: '2026-05-02T09:00:00Z', duration_min: 20, status: 'booked' },
    ],
  },
  baselineFlows: [
    {
      id: 'healthcare.appt-reminder',
      name: 'Appointment Reminder',
      description: '24h and 2h reminders via SMS/WhatsApp with PHI redacted.',
      trigger: 'appointment.scheduled',
      steps: ['wait_until:T-24h', 'compliance:hipaa.phi-redaction', 'send_sms:appt-reminder', 'wait_until:T-2h', 'send_whatsapp:appt-reminder'],
      category: 'communications',
    },
    {
      id: 'healthcare.no-show-recovery',
      name: 'No-show Recovery',
      description: 'Re-engage patients who missed appointments with rebooking link.',
      trigger: 'appointment.no_show',
      steps: ['wait:1h', 'send_sms:rebook-link', 'wait:48h', 'create_task:case_manager'],
      category: 'recovery',
    },
  ],
  dashboards: [
    {
      id: 'healthcare.front-desk',
      name: 'Front Desk',
      audience: 'manager',
      widgets: [
        { id: 'today-appts', type: 'kpi', title: "Today's Appointments", source: 'appointments.today', width: 3 },
        { id: 'no-show-rate', type: 'kpi', title: 'No-show Rate (30d)', source: 'appointments.no_show_30d', width: 3 },
        { id: 'utilisation', type: 'kpi', title: 'Provider Utilisation', source: 'providers.utilisation', width: 3 },
        { id: 'wait-time', type: 'kpi', title: 'Avg Wait Time', source: 'appointments.avg_wait', width: 3 },
        { id: 'schedule', type: 'table', title: "Today's Schedule", source: 'appointments.today_table', width: 12 },
      ],
    },
  ],
  aiAgents: [
    {
      id: 'healthcare.triage-bot',
      name: 'Triage Assistant',
      role: 'Pre-screen patient symptoms and route to the correct speciality. Never gives diagnoses.',
      tools: ['kb.symptoms', 'appointments.find_slot', 'providers.list'],
    },
  ],
  complianceHooks: [
    { id: 'hipaa.baa-gate', reason: 'Tenant must sign BAA before installing healthcare workspace.', on: 'install' },
    { id: 'hipaa.phi-redaction', reason: 'Outbound SMS/WhatsApp must redact PHI fields.', on: 'message' },
    { id: 'hipaa.minimum-necessary', reason: 'Restrict clinical writes to clinical roles.', on: 'write' },
  ],
  messagingTemplates: [
    {
      id: 'healthcare.appt-reminder',
      channel: 'sms',
      name: 'Appointment Reminder (PHI-safe)',
      body: 'Hi {{first_name}}, this is a reminder of your appointment at {{clinic}} on {{date}} at {{time}}.',
      variables: ['first_name', 'clinic', 'date', 'time'],
    },
    {
      id: 'healthcare.rebook-link',
      channel: 'sms',
      name: 'Rebook Link',
      body: 'We missed you today. Rebook your visit here: {{rebook_url}}',
    },
  ],
  contractTemplates: [
    {
      id: 'healthcare.consent-treatment',
      name: 'Consent to Treatment',
      body: 'I, {{patient_name}}, consent to the medical treatment described by {{provider}} dated {{date}}…',
      signers: ['patient', 'provider'],
      jurisdictions: ['US-HIPAA'],
    },
  ],
  recommendedAddons: [
    { id: 'twilio-voice', reason: 'HIPAA-eligible voice channel for appointment reminders.', required: false },
    { id: 'data-fabric:phi-encryption', reason: 'Field-level encryption for PHI columns.', required: true },
  ],
};
