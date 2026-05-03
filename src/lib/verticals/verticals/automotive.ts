/**
 * Automotive vertical — dealerships and service workshops. Combines a sales
 * pipeline (leads → test drive → quote → booked) with a service ledger
 * (RO → diagnosis → parts → invoice).
 */

import type { Vertical } from '../types';

export const AUTOMOTIVE_VERTICAL: Vertical = {
  id: 'automotive',
  name: 'Automotive',
  industry: 'Automotive',
  icon: 'car',
  description:
    'Sales + service workspace for dealerships. Track leads, test-drives, ' +
    'quotes, deliveries, RO (repair orders) and AMC renewals.',
  dataModel: {
    id: 'automotive',
    defaultTags: ['automotive', 'dealership', 'service'],
    entities: [
      {
        name: 'vehicle',
        label: 'Vehicles (Inventory)',
        fields: [
          { key: 'vin', label: 'VIN', type: 'string', required: true, sensitive: true },
          { key: 'make', label: 'Make', type: 'string', required: true },
          { key: 'model', label: 'Model', type: 'string', required: true },
          { key: 'year', label: 'Year', type: 'number' },
          { key: 'trim', label: 'Trim', type: 'string' },
          { key: 'price', label: 'Price', type: 'currency' },
          { key: 'odometer_km', label: 'Odometer (km)', type: 'number' },
          { key: 'status', label: 'Status', type: 'enum', options: ['available', 'reserved', 'sold', 'workshop'] },
        ],
      },
      {
        name: 'sales_lead',
        label: 'Sales Leads',
        stages: ['inquiry', 'test_drive', 'quote', 'negotiation', 'booked', 'delivered', 'lost'],
        fields: [
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'phone', label: 'Phone', type: 'phone', required: true, sensitive: true },
          { key: 'interested_model', label: 'Interested Model', type: 'string' },
          { key: 'budget', label: 'Budget', type: 'currency' },
          { key: 'finance', label: 'Needs Finance', type: 'boolean' },
          { key: 'source', label: 'Source', type: 'enum', options: ['walk_in', 'website', 'referral', 'campaign'] },
        ],
      },
      {
        name: 'service_order',
        label: 'Repair Orders',
        stages: ['booked', 'received', 'diagnosis', 'awaiting_parts', 'in_progress', 'qc', 'delivered'],
        fields: [
          { key: 'ro_no', label: 'RO #', type: 'string', required: true },
          { key: 'vehicle_id', label: 'Vehicle', type: 'reference', ref: 'vehicle' },
          { key: 'customer_phone', label: 'Customer Phone', type: 'phone', sensitive: true },
          { key: 'complaints', label: 'Complaints', type: 'text' },
          { key: 'estimate', label: 'Estimate', type: 'currency' },
          { key: 'final_amount', label: 'Final Amount', type: 'currency' },
          { key: 'promised_at', label: 'Promised At', type: 'datetime' },
          { key: 'status', label: 'Status', type: 'enum', options: ['received', 'in_progress', 'delivered'] },
        ],
      },
    ],
  },
  sampleData: {
    vehicle: [
      { vin: '1HGCM82633A004352', make: 'Honda', model: 'City', year: 2025, trim: 'V CVT', price: 1450000, odometer_km: 0, status: 'available' },
    ],
    sales_lead: [
      { name: 'Sneha Iyer', phone: '+91 90000 77777', interested_model: 'Honda City', budget: 1500000, finance: true, source: 'website' },
    ],
    service_order: [
      { ro_no: 'RO-3001', vehicle_id: 'sample:1', customer_phone: '+91 90000 88888', complaints: '60k service + brake noise', estimate: 18500, status: 'in_progress' },
    ],
  },
  baselineFlows: [
    {
      id: 'automotive.test-drive-confirm',
      name: 'Test Drive Confirmation',
      description: 'Confirm test drive bookings; remind 1h before with showroom address.',
      trigger: 'sales_lead.test_drive_booked',
      steps: ['send_whatsapp:td-confirm', 'wait_until:T-1h', 'send_whatsapp:td-location'],
      category: 'sales',
    },
    {
      id: 'automotive.service-followup',
      name: 'Service Follow-up & CSAT',
      description: 'Vehicle delivered → 24h CSAT survey, 30d AMC reminder.',
      trigger: 'service_order.delivered',
      steps: ['wait:24h', 'send_whatsapp:csat', 'wait:30d', 'send_whatsapp:amc-reminder'],
      category: 'service',
    },
  ],
  dashboards: [
    {
      id: 'automotive.dealer',
      name: 'Dealer Dashboard',
      audience: 'manager',
      widgets: [
        { id: 'leads-mtd', type: 'kpi', title: 'Leads (MTD)', source: 'sales_lead.mtd', width: 3 },
        { id: 'bookings', type: 'kpi', title: 'Bookings (MTD)', source: 'sales_lead.booked_mtd', width: 3 },
        { id: 'open-ros', type: 'kpi', title: 'Open ROs', source: 'service_order.open', width: 3 },
        { id: 'csat', type: 'kpi', title: 'Service CSAT', source: 'service_order.csat', width: 3 },
        { id: 'pipeline', type: 'funnel', title: 'Sales Funnel', source: 'sales_lead.funnel', width: 12 },
      ],
    },
  ],
  aiAgents: [
    {
      id: 'automotive.sales-bot',
      name: 'Showroom Bot',
      role: 'Match buyers with vehicles, schedule test drives, share quotes.',
      tools: ['inventory.search', 'leads.create', 'quotes.compose'],
    },
  ],
  complianceHooks: [
    { id: 'gdpr.lawful-basis', reason: 'Personal data of leads requires lawful basis tag.', on: 'write' },
  ],
  messagingTemplates: [
    {
      id: 'automotive.td-confirm',
      channel: 'whatsapp',
      name: 'Test Drive Confirm',
      body: 'Confirmed: {{model}} test drive on {{date}} at {{time}}. We\'ll see you at {{showroom}}.',
      variables: ['model', 'date', 'time', 'showroom'],
    },
    {
      id: 'automotive.csat',
      channel: 'whatsapp',
      name: 'Service CSAT',
      body: 'Hi {{name}}, how was your service experience? Reply 1–5 with comments.',
    },
    {
      id: 'automotive.amc-reminder',
      channel: 'whatsapp',
      name: 'AMC Reminder',
      body: 'Your AMC for {{model}} ({{plate}}) is due. Book here: {{url}}',
    },
  ],
  contractTemplates: [
    {
      id: 'automotive.sale-agreement',
      name: 'Vehicle Sale Agreement',
      body: 'This sale agreement between {{dealer}} and {{buyer}} for {{vehicle}} dated {{date}}…',
      signers: ['dealer', 'buyer'],
    },
  ],
  recommendedAddons: [
    { id: 'razorpay', reason: 'Booking advance and service invoice payments.' },
    { id: 'sms-otp', reason: 'OTP-verified test-drive bookings.' },
  ],
};
