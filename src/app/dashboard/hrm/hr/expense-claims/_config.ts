import type { HrField } from '../_components/hr-entity-page';

export const fields: HrField[] = [
  { name: 'employeeId', label: 'Employee ID', required: true },
  { name: 'title', label: 'Title', required: true, fullWidth: true },
  { name: 'amount', label: 'Amount', type: 'number', required: true },
  { name: 'currency', label: 'Currency', defaultValue: 'INR' },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { value: 'travel', label: 'Travel' },
      { value: 'meal', label: 'Meal' },
      { value: 'accommodation', label: 'Accommodation' },
      { value: 'transport', label: 'Transport' },
      { value: 'office-supplies', label: 'Office Supplies' },
      { value: 'entertainment', label: 'Entertainment' },
      { value: 'medical', label: 'Medical' },
      { value: 'training', label: 'Training' },
      { value: 'other', label: 'Other' },
    ],
    defaultValue: 'other',
  },
  { name: 'subCategory', label: 'Sub-category' },
  { name: 'incurredAt', label: 'Incurred At', type: 'date', required: true },
  { name: 'merchantName', label: 'Merchant Name' },
  {
    name: 'paymentMode',
    label: 'Payment Mode',
    type: 'select',
    options: [
      { value: 'cash', label: 'Cash' },
      { value: 'card', label: 'Card' },
      { value: 'upi', label: 'UPI' },
      { value: 'cheque', label: 'Cheque' },
      { value: 'bank-transfer', label: 'Bank Transfer' },
      { value: 'company-card', label: 'Company Card' },
    ],
  },
  { name: 'receiptUrl', label: 'Receipt URL', type: 'url' },
  { name: 'gstAmount', label: 'GST Amount', type: 'number' },
  { name: 'projectId', label: 'Project ID' },
  {
    name: 'billableToClient',
    label: 'Billable to Client',
    type: 'select',
    options: [
      { value: 'no', label: 'No' },
      { value: 'yes', label: 'Yes' },
    ],
    defaultValue: 'no',
  },
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
      { value: 'reimbursed', label: 'Reimbursed' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
    defaultValue: 'pending',
  },
  { name: 'approvedAt', label: 'Approved At', type: 'date' },
  { name: 'approvedAmount', label: 'Approved Amount', type: 'number' },
  { name: 'reimbursedAt', label: 'Reimbursed At', type: 'date' },
  {
    name: 'reimbursementMethod',
    label: 'Reimbursement Method',
    type: 'select',
    options: [
      { value: 'payroll', label: 'Payroll' },
      { value: 'bank-transfer', label: 'Bank Transfer' },
      { value: 'cheque', label: 'Cheque' },
      { value: 'petty-cash', label: 'Petty Cash' },
    ],
  },
  {
    name: 'rejectionReason',
    label: 'Rejection Reason',
    type: 'textarea',
    fullWidth: true,
  },
  { name: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
];

export const sections = [
  {
    title: 'Claim',
    fieldNames: [
      'title',
      'employeeId',
      'amount',
      'currency',
      'category',
      'subCategory',
    ],
  },
  {
    title: 'Transaction',
    fieldNames: [
      'incurredAt',
      'merchantName',
      'paymentMode',
      'receiptUrl',
      'gstAmount',
    ],
  },
  {
    title: 'Project',
    fieldNames: ['projectId', 'billableToClient'],
  },
  {
    title: 'Approval',
    fieldNames: [
      'approverName',
      'approverEmail',
      'status',
      'approvedAt',
      'approvedAmount',
      'rejectionReason',
    ],
  },
  {
    title: 'Reimbursement',
    fieldNames: ['reimbursedAt', 'reimbursementMethod'],
  },
  { title: 'Notes', fieldNames: ['notes'] },
];
