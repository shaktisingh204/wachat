/**
 * Retail vertical — D2C / B2C ecommerce shops with WhatsApp-first ordering,
 * loyalty, and abandoned-cart recovery.
 */

import type { Vertical } from '../types';

export const RETAIL_VERTICAL: Vertical = {
  id: 'retail',
  name: 'Retail & E-commerce',
  industry: 'Retail',
  icon: 'shopping-bag',
  description:
    'Storefront-ready vertical for D2C brands. Includes order CRM, abandoned-cart recovery, ' +
    'loyalty campaigns and a WhatsApp catalog flow.',
  dataModel: {
    id: 'retail',
    defaultTags: ['retail', 'd2c', 'ecommerce'],
    entities: [
      {
        name: 'product',
        label: 'Products',
        description: 'Sellable SKUs synced from the storefront.',
        fields: [
          { key: 'sku', label: 'SKU', type: 'string', required: true },
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'price', label: 'Price', type: 'currency', required: true },
          { key: 'inventory', label: 'Inventory', type: 'number' },
          { key: 'category', label: 'Category', type: 'string' },
          { key: 'image_url', label: 'Image URL', type: 'url' },
        ],
      },
      {
        name: 'order',
        label: 'Orders',
        stages: ['cart', 'checkout', 'paid', 'fulfilled', 'returned'],
        fields: [
          { key: 'order_no', label: 'Order #', type: 'string', required: true },
          { key: 'customer_id', label: 'Customer', type: 'reference', ref: 'customer' },
          { key: 'total', label: 'Total', type: 'currency' },
          { key: 'channel', label: 'Channel', type: 'enum', options: ['web', 'whatsapp', 'instagram', 'pos'] },
          { key: 'status', label: 'Status', type: 'enum', options: ['cart', 'paid', 'fulfilled', 'returned'] },
        ],
      },
      {
        name: 'customer',
        label: 'Customers',
        fields: [
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'phone', label: 'Phone', type: 'phone', sensitive: true },
          { key: 'email', label: 'Email', type: 'email', sensitive: true },
          { key: 'lifetime_value', label: 'LTV', type: 'currency' },
          { key: 'loyalty_tier', label: 'Loyalty Tier', type: 'enum', options: ['bronze', 'silver', 'gold', 'vip'] },
        ],
      },
    ],
  },
  sampleData: {
    product: [
      { sku: 'TS-RED-M', name: 'Red Tee (M)', price: 1499, inventory: 42, category: 'Apparel' },
      { sku: 'MUG-BLK', name: 'Matte Black Mug', price: 599, inventory: 110, category: 'Home' },
    ],
    customer: [
      { name: 'Aanya Sharma', phone: '+91 90000 11111', loyalty_tier: 'silver', lifetime_value: 8200 },
      { name: 'Rohan Mehta', phone: '+91 90000 22222', loyalty_tier: 'gold', lifetime_value: 24500 },
    ],
    order: [
      { order_no: 'SN-1001', customer_id: 'sample:1', total: 1499, channel: 'whatsapp', status: 'paid' },
    ],
  },
  baselineFlows: [
    {
      id: 'retail.abandoned-cart',
      name: 'Abandoned Cart Recovery',
      description: 'Recover carts left for >30 minutes with a 2-step WhatsApp nudge + 10% discount.',
      trigger: 'order.cart_abandoned',
      steps: ['wait:30m', 'send_whatsapp:cart-nudge', 'wait:24h', 'send_whatsapp:discount-10'],
      category: 'recovery',
    },
    {
      id: 'retail.loyalty-tier-upgrade',
      name: 'Loyalty Tier Upgrade',
      description: 'Auto-promote customers crossing LTV thresholds and notify them.',
      trigger: 'customer.ltv_changed',
      steps: ['evaluate:tier', 'update_field:loyalty_tier', 'send_whatsapp:tier-upgrade'],
      category: 'loyalty',
    },
  ],
  dashboards: [
    {
      id: 'retail.gm-dashboard',
      name: 'Storefront Pulse',
      audience: 'owner',
      widgets: [
        { id: 'gmv', type: 'kpi', title: 'GMV (7d)', source: 'orders.gmv_7d', width: 3 },
        { id: 'orders', type: 'kpi', title: 'Orders (7d)', source: 'orders.count_7d', width: 3 },
        { id: 'aov', type: 'kpi', title: 'AOV', source: 'orders.aov', width: 3 },
        { id: 'recovery', type: 'kpi', title: 'Cart Recovery', source: 'flows.recovery_rate', width: 3 },
        { id: 'top-products', type: 'table', title: 'Top Products', source: 'products.top_skus', width: 6 },
        { id: 'channel-mix', type: 'chart', title: 'Channel Mix', source: 'orders.by_channel', width: 6 },
      ],
    },
  ],
  aiAgents: [
    {
      id: 'retail.shop-concierge',
      name: 'Shop Concierge',
      role: 'Answer product questions and guide checkout on WhatsApp.',
      tools: ['catalog.search', 'orders.create', 'inventory.check'],
    },
  ],
  complianceHooks: [
    { id: 'gdpr.lawful-basis', reason: 'EU customers may interact with WhatsApp campaigns.', on: 'message' },
  ],
  messagingTemplates: [
    {
      id: 'retail.cart-nudge',
      channel: 'whatsapp',
      name: 'Cart Nudge',
      body: 'Hi {{name}}, you left {{item_count}} items in your cart. Need help?',
      variables: ['name', 'item_count'],
    },
    {
      id: 'retail.discount-10',
      channel: 'whatsapp',
      name: '10% Discount',
      body: 'Use code SAVE10 in the next 24h for 10% off your cart.',
    },
    {
      id: 'retail.tier-upgrade',
      channel: 'whatsapp',
      name: 'Loyalty Tier Upgrade',
      body: 'Welcome to {{tier}}, {{name}}! Enjoy {{perks}}.',
      variables: ['name', 'tier', 'perks'],
    },
  ],
  contractTemplates: [
    {
      id: 'retail.influencer-mou',
      name: 'Influencer MOU',
      body: 'This MOU between {{brand}} and {{creator}} dated {{date}} covers a {{duration}} promo …',
      signers: ['brand', 'creator'],
    },
  ],
  recommendedAddons: [
    { id: 'shopify-sync', reason: 'Two-way sync of products, orders and inventory.' },
    { id: 'razorpay', reason: 'Payments for India-based stores.' },
  ],
};
