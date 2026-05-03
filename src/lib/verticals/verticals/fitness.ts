/**
 * Fitness vertical — gyms, studios and personal trainers. Membership
 * lifecycle, class booking, attendance and trainer assignments.
 */

import type { Vertical } from '../types';

export const FITNESS_VERTICAL: Vertical = {
  id: 'fitness',
  name: 'Fitness & Wellness',
  industry: 'Fitness',
  icon: 'dumbbell',
  description:
    'Membership and class-booking workspace for gyms and studios. Includes ' +
    'check-ins, attendance, churn-risk scoring and trainer scheduling.',
  dataModel: {
    id: 'fitness',
    defaultTags: ['fitness', 'gym', 'wellness'],
    entities: [
      {
        name: 'member',
        label: 'Members',
        stages: ['trial', 'active', 'frozen', 'expired', 'churned'],
        fields: [
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'phone', label: 'Phone', type: 'phone', sensitive: true },
          { key: 'email', label: 'Email', type: 'email', sensitive: true },
          { key: 'plan', label: 'Plan', type: 'enum', options: ['monthly', 'quarterly', 'annual', 'pt'] },
          { key: 'starts_on', label: 'Starts', type: 'date' },
          { key: 'expires_on', label: 'Expires', type: 'date' },
          { key: 'trainer_id', label: 'Trainer', type: 'reference', ref: 'trainer' },
          { key: 'fitness_goals', label: 'Goals', type: 'text' },
          { key: 'churn_risk', label: 'Churn Risk', type: 'enum', options: ['low', 'medium', 'high'] },
        ],
      },
      {
        name: 'class_session',
        label: 'Classes',
        fields: [
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'trainer_id', label: 'Trainer', type: 'reference', ref: 'trainer' },
          { key: 'starts_at', label: 'Starts', type: 'datetime', required: true },
          { key: 'duration_min', label: 'Duration (min)', type: 'number' },
          { key: 'capacity', label: 'Capacity', type: 'number' },
          { key: 'booked', label: 'Booked', type: 'number' },
          { key: 'type', label: 'Type', type: 'enum', options: ['yoga', 'hiit', 'spin', 'strength', 'pilates'] },
        ],
      },
      {
        name: 'trainer',
        label: 'Trainers',
        fields: [
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'specialities', label: 'Specialities', type: 'text' },
          { key: 'rating', label: 'Rating', type: 'number' },
        ],
      },
      {
        name: 'check_in',
        label: 'Check-ins',
        fields: [
          { key: 'member_id', label: 'Member', type: 'reference', ref: 'member', required: true },
          { key: 'at', label: 'At', type: 'datetime', required: true },
          { key: 'method', label: 'Method', type: 'enum', options: ['qr', 'card', 'manual'] },
        ],
      },
    ],
  },
  sampleData: {
    trainer: [
      { name: 'Coach Rina', specialities: 'HIIT, Strength', rating: 4.8 },
    ],
    member: [
      { name: 'Manish Kumar', phone: '+91 90000 66666', plan: 'quarterly', starts_on: '2026-01-15', expires_on: '2026-04-15', churn_risk: 'high' },
    ],
    class_session: [
      { name: 'Morning HIIT', trainer_id: 'sample:1', starts_at: '2026-04-26T06:00:00Z', duration_min: 45, capacity: 18, booked: 12, type: 'hiit' },
    ],
    check_in: [
      { member_id: 'sample:1', at: '2026-04-22T07:05:00Z', method: 'qr' },
    ],
  },
  baselineFlows: [
    {
      id: 'fitness.renewal-nudge',
      name: 'Renewal Nudge',
      description: 'Notify members 14 / 7 / 1 days before plan expiry with renewal link.',
      trigger: 'member.expires_in_15d',
      steps: ['wait_until:expiry-14d', 'send_whatsapp:renew-14d', 'wait_until:expiry-7d', 'send_whatsapp:renew-7d', 'wait_until:expiry-1d', 'send_whatsapp:renew-1d'],
      category: 'retention',
    },
    {
      id: 'fitness.churn-rescue',
      name: 'Churn Rescue',
      description: 'When a member has not checked in for 14 days, ping with a free PT session.',
      trigger: 'member.no_checkin_14d',
      steps: ['mark:churn_risk_high', 'send_whatsapp:we-miss-you', 'create_task:trainer'],
      category: 'retention',
    },
  ],
  dashboards: [
    {
      id: 'fitness.studio',
      name: 'Studio Dashboard',
      audience: 'manager',
      widgets: [
        { id: 'active', type: 'kpi', title: 'Active Members', source: 'members.active', width: 3 },
        { id: 'churn-risk', type: 'kpi', title: 'High Churn Risk', source: 'members.churn_high', width: 3 },
        { id: 'classes-week', type: 'kpi', title: 'Classes This Week', source: 'classes.this_week', width: 3 },
        { id: 'utilisation', type: 'kpi', title: 'Class Utilisation', source: 'classes.utilisation', width: 3 },
        { id: 'attendance', type: 'chart', title: 'Daily Check-ins', source: 'check_in.daily', width: 12 },
      ],
    },
  ],
  aiAgents: [
    {
      id: 'fitness.coach-bot',
      name: 'Coach Bot',
      role: 'Suggest plans, answer questions about classes and reschedule sessions on WhatsApp.',
      tools: ['classes.find_slot', 'members.read', 'plans.recommend'],
    },
  ],
  complianceHooks: [],
  messagingTemplates: [
    {
      id: 'fitness.renew-7d',
      channel: 'whatsapp',
      name: 'Renew (7d)',
      body: 'Hi {{name}}, your {{plan}} expires in 7 days. Renew here: {{url}}',
      variables: ['name', 'plan', 'url'],
    },
    {
      id: 'fitness.we-miss-you',
      channel: 'whatsapp',
      name: 'We Miss You',
      body: '{{name}}, haven\'t seen you in a while! Book a free PT slot: {{url}}',
    },
  ],
  contractTemplates: [
    {
      id: 'fitness.membership-agreement',
      name: 'Membership Agreement',
      body: 'This membership agreement between {{studio}} and {{member}} dated {{date}}…',
      signers: ['studio', 'member'],
    },
  ],
  recommendedAddons: [
    { id: 'razorpay-subscriptions', reason: 'Recurring billing for plans.' },
    { id: 'whatsapp-business', reason: 'Renewal nudges and class booking.' },
  ],
};
