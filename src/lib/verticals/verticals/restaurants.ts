/**
 * Restaurants vertical — single-location and small chains. Reservation
 * management, menu publishing and feedback capture.
 */

import type { Vertical } from '../types';

export const RESTAURANTS_VERTICAL: Vertical = {
  id: 'restaurants',
  name: 'Restaurants & Hospitality',
  industry: 'Hospitality',
  icon: 'utensils',
  description:
    'Front-of-house workspace for restaurants. Reservations, walk-in waitlists, ' +
    'feedback collection and review nudges.',
  dataModel: {
    id: 'restaurants',
    defaultTags: ['restaurant', 'food', 'hospitality'],
    entities: [
      {
        name: 'menu_item',
        label: 'Menu Items',
        fields: [
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'description', label: 'Description', type: 'text' },
          { key: 'price', label: 'Price', type: 'currency', required: true },
          { key: 'category', label: 'Category', type: 'enum', options: ['starter', 'main', 'dessert', 'beverage'] },
          { key: 'spice_level', label: 'Spice', type: 'enum', options: ['none', 'mild', 'medium', 'hot'] },
          { key: 'veg', label: 'Vegetarian', type: 'boolean' },
          { key: 'available', label: 'Available', type: 'boolean' },
        ],
      },
      {
        name: 'reservation',
        label: 'Reservations',
        stages: ['requested', 'confirmed', 'seated', 'completed', 'no_show', 'cancelled'],
        fields: [
          { key: 'guest_name', label: 'Guest Name', type: 'string', required: true },
          { key: 'phone', label: 'Phone', type: 'phone', required: true, sensitive: true },
          { key: 'party_size', label: 'Party Size', type: 'number', required: true },
          { key: 'when', label: 'When', type: 'datetime', required: true },
          { key: 'table', label: 'Table', type: 'string' },
          { key: 'occasion', label: 'Occasion', type: 'enum', options: ['none', 'birthday', 'anniversary', 'date'] },
          { key: 'status', label: 'Status', type: 'enum', options: ['confirmed', 'seated', 'completed', 'no_show'] },
        ],
      },
      {
        name: 'feedback',
        label: 'Feedback',
        fields: [
          { key: 'reservation_id', label: 'Reservation', type: 'reference', ref: 'reservation' },
          { key: 'rating', label: 'Rating', type: 'number' },
          { key: 'comment', label: 'Comment', type: 'text' },
          { key: 'food_score', label: 'Food', type: 'number' },
          { key: 'service_score', label: 'Service', type: 'number' },
        ],
      },
    ],
  },
  sampleData: {
    menu_item: [
      { name: 'Butter Chicken', description: 'Tomato-cream curry', price: 480, category: 'main', spice_level: 'mild', veg: false, available: true },
      { name: 'Paneer Tikka', description: 'Charred cottage cheese', price: 380, category: 'starter', spice_level: 'medium', veg: true, available: true },
    ],
    reservation: [
      { guest_name: 'Anita Rao', phone: '+91 90000 55555', party_size: 4, when: '2026-04-26T20:00:00Z', table: 'T-7', status: 'confirmed' },
    ],
    feedback: [
      { reservation_id: 'sample:1', rating: 5, comment: 'Loved the paneer tikka!', food_score: 5, service_score: 5 },
    ],
  },
  baselineFlows: [
    {
      id: 'restaurants.reservation-confirm',
      name: 'Reservation Confirmation',
      description: 'Confirm via WhatsApp on book; send reminder 2h before.',
      trigger: 'reservation.created',
      steps: ['send_whatsapp:res-confirm', 'wait_until:T-2h', 'send_whatsapp:res-reminder'],
      category: 'guest-comms',
    },
    {
      id: 'restaurants.feedback-loop',
      name: 'Post-meal Feedback',
      description: 'Ask for feedback 90 minutes after the reservation start time.',
      trigger: 'reservation.completed',
      steps: ['wait:90m', 'send_whatsapp:feedback-form', 'wait:24h', 'route:google_review_if_5'],
      category: 'reviews',
    },
  ],
  dashboards: [
    {
      id: 'restaurants.host',
      name: 'Host Console',
      audience: 'manager',
      widgets: [
        { id: 'tonight', type: 'kpi', title: 'Tonight Covers', source: 'reservations.tonight_covers', width: 3 },
        { id: 'no-show', type: 'kpi', title: 'No-show Rate', source: 'reservations.no_show', width: 3 },
        { id: 'avg-rating', type: 'kpi', title: 'Avg Rating', source: 'feedback.avg_rating', width: 3 },
        { id: 'reviews', type: 'kpi', title: 'New Google Reviews', source: 'reviews.new_count', width: 3 },
        { id: 'tonight-table', type: 'table', title: 'Tonight Bookings', source: 'reservations.tonight_table', width: 12 },
      ],
    },
  ],
  aiAgents: [
    {
      id: 'restaurants.maitre',
      name: 'Maître d Bot',
      role: 'Take reservations on WhatsApp, propose alternative slots, handle special requests.',
      tools: ['reservations.find_slot', 'reservations.create', 'menu.search'],
    },
  ],
  complianceHooks: [],
  messagingTemplates: [
    {
      id: 'restaurants.res-confirm',
      channel: 'whatsapp',
      name: 'Reservation Confirm',
      body: 'Booked! {{party_size}} guests, {{date}} at {{time}}. Reply CHANGE to modify.',
      variables: ['party_size', 'date', 'time'],
    },
    {
      id: 'restaurants.feedback-form',
      channel: 'whatsapp',
      name: 'Feedback Form',
      body: 'Hope you enjoyed your meal! How was it (1–5)? Reply with a number and a comment.',
    },
  ],
  contractTemplates: [
    {
      id: 'restaurants.event-booking',
      name: 'Private Event Booking',
      body: 'This private event booking between {{venue}} and {{host}} dated {{date}}…',
      signers: ['venue', 'host'],
    },
  ],
  recommendedAddons: [
    { id: 'google-business', reason: 'Pull and respond to Google reviews.' },
    { id: 'whatsapp-business', reason: 'Take reservations directly on WhatsApp.', required: true },
  ],
};
