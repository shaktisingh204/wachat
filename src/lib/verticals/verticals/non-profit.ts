/**
 * Non-profit vertical — NGOs and foundations. Donor CRM, campaign tracking,
 * volunteer management and grant reporting.
 */

import type { Vertical } from '../types';

export const NON_PROFIT_VERTICAL: Vertical = {
  id: 'non-profit',
  name: 'Non-profit',
  industry: 'Non-profit',
  icon: 'heart',
  description:
    'Donor and volunteer CRM for NGOs. Tracks campaigns, recurring donations, ' +
    'volunteer shifts and grant reporting.',
  dataModel: {
    id: 'non-profit',
    defaultTags: ['nonprofit', 'ngo'],
    entities: [
      {
        name: 'donor',
        label: 'Donors',
        stages: ['prospect', 'first_gift', 'recurring', 'major', 'lapsed'],
        fields: [
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'email', label: 'Email', type: 'email', sensitive: true },
          { key: 'phone', label: 'Phone', type: 'phone', sensitive: true },
          { key: 'lifetime_giving', label: 'Lifetime Giving', type: 'currency' },
          { key: 'gift_count', label: 'Gift Count', type: 'number' },
          { key: 'recurring', label: 'Recurring', type: 'boolean' },
          { key: 'tax_id', label: 'Tax ID', type: 'string', sensitive: true },
        ],
      },
      {
        name: 'campaign',
        label: 'Campaigns',
        fields: [
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'goal', label: 'Goal', type: 'currency' },
          { key: 'raised', label: 'Raised', type: 'currency' },
          { key: 'starts_at', label: 'Starts', type: 'date' },
          { key: 'ends_at', label: 'Ends', type: 'date' },
          { key: 'status', label: 'Status', type: 'enum', options: ['draft', 'active', 'completed'] },
        ],
      },
      {
        name: 'donation',
        label: 'Donations',
        fields: [
          { key: 'donor_id', label: 'Donor', type: 'reference', ref: 'donor', required: true },
          { key: 'campaign_id', label: 'Campaign', type: 'reference', ref: 'campaign' },
          { key: 'amount', label: 'Amount', type: 'currency', required: true },
          { key: 'made_at', label: 'Made At', type: 'datetime' },
          { key: 'method', label: 'Method', type: 'enum', options: ['card', 'bank', 'upi', 'check', 'cash'] },
          { key: 'receipted', label: 'Receipted', type: 'boolean' },
        ],
      },
      {
        name: 'volunteer',
        label: 'Volunteers',
        fields: [
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'email', label: 'Email', type: 'email', sensitive: true },
          { key: 'skills', label: 'Skills', type: 'text' },
          { key: 'hours_logged', label: 'Hours Logged', type: 'number' },
        ],
      },
    ],
  },
  sampleData: {
    donor: [
      { name: 'Meera Foundation', email: 'gifts@meera.example', lifetime_giving: 1500000, gift_count: 12, recurring: true },
    ],
    campaign: [
      { name: 'Monsoon Relief 2026', goal: 5000000, raised: 1250000, starts_at: '2026-06-01', ends_at: '2026-09-30', status: 'active' },
    ],
    donation: [
      { donor_id: 'sample:1', campaign_id: 'sample:1', amount: 50000, made_at: '2026-04-10T08:30:00Z', method: 'bank', receipted: true },
    ],
    volunteer: [
      { name: 'Karthik Iyer', email: 'k@example.org', skills: 'photography, logistics', hours_logged: 24 },
    ],
  },
  baselineFlows: [
    {
      id: 'non-profit.donation-thank',
      name: 'Donation Thank-you & Receipt',
      description: 'Thank donor immediately and email an 80G receipt within 24h.',
      trigger: 'donation.received',
      steps: ['send_email:thank-you', 'wait:5m', 'generate_receipt:80g', 'send_email:receipt'],
      category: 'stewardship',
    },
    {
      id: 'non-profit.lapsed-recovery',
      name: 'Lapsed Donor Recovery',
      description: 'Re-engage donors with no gift in 18 months.',
      trigger: 'donor.lapsed_18m',
      steps: ['compose:re-engage', 'send_email:lapsed', 'wait:14d', 'create_task:major_gifts_team'],
      category: 'retention',
    },
  ],
  dashboards: [
    {
      id: 'non-profit.development',
      name: 'Development Dashboard',
      audience: 'manager',
      widgets: [
        { id: 'raised-mtd', type: 'kpi', title: 'Raised (MTD)', source: 'donations.mtd', width: 3 },
        { id: 'donors-active', type: 'kpi', title: 'Active Donors', source: 'donors.active', width: 3 },
        { id: 'recurring', type: 'kpi', title: 'Recurring %', source: 'donors.recurring_pct', width: 3 },
        { id: 'volunteers', type: 'kpi', title: 'Volunteer Hours', source: 'volunteers.hours_mtd', width: 3 },
        { id: 'campaign-progress', type: 'chart', title: 'Campaign Progress', source: 'campaigns.progress', width: 12 },
      ],
    },
  ],
  aiAgents: [
    {
      id: 'non-profit.appeal-writer',
      name: 'Appeal Writer',
      role: 'Draft donor-segment-aware appeal copy from campaign briefs.',
      tools: ['campaigns.read', 'donors.segments', 'docs.compose'],
    },
  ],
  complianceHooks: [
    { id: 'gdpr.lawful-basis', reason: 'EU donors require lawful-basis tracking for fundraising.', on: 'write' },
  ],
  messagingTemplates: [
    {
      id: 'non-profit.thank-you',
      channel: 'email',
      name: 'Donation Thank-you',
      body: 'Dear {{name}}, thank you for your gift of {{amount}} to {{campaign}}. Your receipt will follow within 24 hours.',
      variables: ['name', 'amount', 'campaign'],
    },
    {
      id: 'non-profit.lapsed',
      channel: 'email',
      name: 'Lapsed Donor',
      body: 'We miss you, {{name}}. Here is what {{org}} has been up to: {{updates}}',
    },
  ],
  contractTemplates: [
    {
      id: 'non-profit.grant-agreement',
      name: 'Grant Agreement',
      body: 'This grant agreement between {{funder}} and {{grantee}} for {{amount}} dated {{date}}…',
      signers: ['funder', 'grantee'],
    },
  ],
  recommendedAddons: [
    { id: 'razorpay', reason: 'Recurring donations.' },
    { id: 'mailchimp', reason: 'Donor newsletters.' },
  ],
};
