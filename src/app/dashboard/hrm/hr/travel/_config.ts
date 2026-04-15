import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'employeeId', label: 'Employee ID', required: true },
  { name: 'destination', label: 'Destination', required: true },
  { name: 'destinationCountry', label: 'Destination Country' },
  { name: 'purpose', label: 'Purpose', fullWidth: true },
  { name: 'fromDate', label: 'From Date', type: 'date', required: true },
  { name: 'toDate', label: 'To Date', type: 'date', required: true },
  {
    name: 'mode',
    label: 'Mode',
    type: 'select',
    options: [
      { value: 'flight', label: 'Flight' },
      { value: 'train', label: 'Train' },
      { value: 'car', label: 'Car' },
      { value: 'bus', label: 'Bus' },
      { value: 'hotel-only', label: 'Hotel Only' },
    ],
  },
  {
    name: 'accommodationNeeded',
    label: 'Accommodation Needed',
    type: 'select',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  { name: 'hotelPreference', label: 'Hotel Preference' },
  {
    name: 'flightClass',
    label: 'Flight Class',
    type: 'select',
    options: [
      { value: 'economy', label: 'Economy' },
      { value: 'premium-economy', label: 'Premium Economy' },
      { value: 'business', label: 'Business' },
      { value: 'first', label: 'First' },
    ],
  },
  { name: 'travelPartnerName', label: 'Travel Partner Name' },
  { name: 'estimatedCost', label: 'Estimated Cost', type: 'number' },
  { name: 'advanceAmount', label: 'Advance Amount', type: 'number' },
  { name: 'currency', label: 'Currency', defaultValue: 'INR' },
  { name: 'bookingReference', label: 'Booking Reference' },
  { name: 'approverName', label: 'Approver Name' },
  { name: 'approverEmail', label: 'Approver Email', type: 'email' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'approved', label: 'Approved' },
      { value: 'rejected', label: 'Rejected' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
    defaultValue: 'pending',
  },
  { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
];

export const sections = [
  {
    title: 'Trip',
    fieldNames: [
      'employeeId',
      'destination',
      'destinationCountry',
      'purpose',
      'fromDate',
      'toDate',
      'mode',
      'travelPartnerName',
    ],
  },
  {
    title: 'Travel preferences',
    fieldNames: [
      'accommodationNeeded',
      'hotelPreference',
      'flightClass',
    ],
  },
  {
    title: 'Finance',
    fieldNames: [
      'estimatedCost',
      'advanceAmount',
      'currency',
      'bookingReference',
    ],
  },
  {
    title: 'Approval',
    fieldNames: ['approverName', 'approverEmail', 'status', 'notes'],
  },
];
