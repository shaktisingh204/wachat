/**
 * Real Estate vertical — brokerages and property developers. Lead-to-deal
 * pipeline with property catalog, site-visit scheduling and document
 * collection.
 */

import type { Vertical } from '../types';

export const REAL_ESTATE_VERTICAL: Vertical = {
  id: 'real-estate',
  name: 'Real Estate',
  industry: 'Real Estate',
  icon: 'building',
  description:
    'Brokerage CRM with listings, lead scoring, site-visit scheduling and ' +
    'document workflow for sale/lease transactions.',
  dataModel: {
    id: 'real-estate',
    defaultTags: ['real-estate', 'broker'],
    entities: [
      {
        name: 'property',
        label: 'Properties',
        fields: [
          { key: 'listing_id', label: 'Listing ID', type: 'string', required: true },
          { key: 'title', label: 'Title', type: 'string', required: true },
          { key: 'type', label: 'Type', type: 'enum', options: ['apartment', 'villa', 'plot', 'office', 'retail'] },
          { key: 'bedrooms', label: 'Bedrooms', type: 'number' },
          { key: 'area_sqft', label: 'Area (sqft)', type: 'number' },
          { key: 'price', label: 'Price', type: 'currency' },
          { key: 'rent', label: 'Rent / mo', type: 'currency' },
          { key: 'address', label: 'Address', type: 'text' },
          { key: 'lat', label: 'Latitude', type: 'number' },
          { key: 'lng', label: 'Longitude', type: 'number' },
          { key: 'status', label: 'Status', type: 'enum', options: ['available', 'under_offer', 'sold', 'leased'] },
        ],
      },
      {
        name: 'lead',
        label: 'Leads',
        stages: ['new', 'contacted', 'qualified', 'site_visit', 'negotiation', 'closed_won', 'closed_lost'],
        fields: [
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'phone', label: 'Phone', type: 'phone', required: true, sensitive: true },
          { key: 'email', label: 'Email', type: 'email', sensitive: true },
          { key: 'budget', label: 'Budget', type: 'currency' },
          { key: 'preferred_locations', label: 'Preferred Locations', type: 'text' },
          { key: 'intent', label: 'Intent', type: 'enum', options: ['buy', 'rent', 'invest'] },
          { key: 'score', label: 'Lead Score', type: 'number' },
          { key: 'source', label: 'Source', type: 'enum', options: ['portal', 'walk_in', 'referral', 'whatsapp', 'website'] },
        ],
      },
      {
        name: 'site_visit',
        label: 'Site Visits',
        fields: [
          { key: 'lead_id', label: 'Lead', type: 'reference', ref: 'lead', required: true },
          { key: 'property_id', label: 'Property', type: 'reference', ref: 'property', required: true },
          { key: 'scheduled_at', label: 'Scheduled At', type: 'datetime', required: true },
          { key: 'agent_id', label: 'Agent', type: 'reference', ref: 'user' },
          { key: 'feedback', label: 'Visit Feedback', type: 'text' },
        ],
      },
    ],
  },
  sampleData: {
    property: [
      { listing_id: 'BH-9001', title: '3BHK in Bandra West', type: 'apartment', bedrooms: 3, area_sqft: 1450, price: 42000000, status: 'available' },
      { listing_id: 'BH-9002', title: 'Sea-view Villa, Goa', type: 'villa', bedrooms: 4, area_sqft: 3200, price: 95000000, status: 'available' },
    ],
    lead: [
      { name: 'Vikram Iyer', phone: '+91 90000 33333', budget: 50000000, intent: 'buy', score: 78, source: 'portal' },
    ],
    site_visit: [
      { lead_id: 'sample:1', property_id: 'sample:1', scheduled_at: '2026-05-04T10:30:00Z' },
    ],
  },
  baselineFlows: [
    {
      id: 'real-estate.lead-qualifier',
      name: 'Inbound Lead Qualifier',
      description: 'Score new leads, ask budget on WhatsApp, route hot ones to senior agents.',
      trigger: 'lead.created',
      steps: ['ai_call:lead-scorer', 'send_whatsapp:budget-question', 'wait_response:24h', 'route:by_score'],
      category: 'lead-management',
    },
    {
      id: 'real-estate.site-visit-reminder',
      name: 'Site Visit Reminder',
      description: 'Confirm 24h before, send pin location 1h before.',
      trigger: 'site_visit.scheduled',
      steps: ['wait_until:T-24h', 'send_whatsapp:visit-confirm', 'wait_until:T-1h', 'send_whatsapp:visit-location'],
      category: 'logistics',
    },
  ],
  dashboards: [
    {
      id: 'real-estate.broker-dash',
      name: 'Broker Pipeline',
      audience: 'manager',
      widgets: [
        { id: 'leads-7d', type: 'kpi', title: 'New Leads (7d)', source: 'leads.count_7d', width: 3 },
        { id: 'visits-week', type: 'kpi', title: 'Site Visits This Week', source: 'site_visits.this_week', width: 3 },
        { id: 'closed-mtd', type: 'kpi', title: 'Closed (MTD)', source: 'leads.closed_won_mtd', width: 3 },
        { id: 'gci', type: 'kpi', title: 'Gross Commission', source: 'deals.gci_mtd', width: 3 },
        { id: 'pipeline', type: 'funnel', title: 'Lead Funnel', source: 'leads.funnel', width: 12 },
      ],
    },
  ],
  aiAgents: [
    {
      id: 'real-estate.matcher',
      name: 'Property Matcher',
      role: 'Recommend properties to a lead given budget, location and intent.',
      tools: ['catalog.search', 'leads.read', 'maps.geocode'],
    },
  ],
  complianceHooks: [
    { id: 'gdpr.lawful-basis', reason: 'Track lawful basis for cross-border buyers.', on: 'write' },
  ],
  messagingTemplates: [
    {
      id: 'real-estate.budget-question',
      channel: 'whatsapp',
      name: 'Budget Question',
      body: 'Hi {{name}}, thanks for your interest in {{listing}}. What is your budget range?',
      variables: ['name', 'listing'],
    },
    {
      id: 'real-estate.visit-confirm',
      channel: 'whatsapp',
      name: 'Site Visit Confirm',
      body: 'Confirming your visit at {{listing}} on {{date}} at {{time}}. Reply CANCEL to reschedule.',
    },
  ],
  contractTemplates: [
    {
      id: 'real-estate.commission-agreement',
      name: 'Commission Agreement',
      body: 'This commission agreement between {{broker}} and {{client}} for the sale of {{property}} dated {{date}}…',
      signers: ['broker', 'client'],
    },
  ],
  recommendedAddons: [
    { id: 'maps-google', reason: 'Pin sharing & route optimisation for site visits.' },
    { id: 'docusign', reason: 'E-signature for sale agreements.' },
  ],
};
