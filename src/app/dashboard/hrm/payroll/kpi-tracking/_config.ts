/**
 * KPI form config — server action `saveCrmKpi` reads:
 *   kpi_name, employee_id, target_value, actual_value, unit, period,
 *   status, id.
 *
 * Brief-additional fields (formula, department, applicableTo) accepted
 * but not yet persisted — TODO 1D.3.
 */

import type { HrField } from '../../hr/_components/hr-entity-page';

export const fields: HrField[] = [
  {
    name: 'kpi_name',
    label: 'KPI name',
    required: true,
    fullWidth: true,
    placeholder: 'e.g. Monthly sales revenue',
  },
  {
    name: 'formula',
    label: 'Formula / definition',
    type: 'textarea',
    fullWidth: true,
    placeholder: 'How is this KPI calculated?',
  },
  {
    name: 'department_id',
    label: 'Department',
    type: 'entity',
    entity: 'department',
  },
  {
    name: 'employee_id',
    label: 'Employee',
    type: 'entity',
    entity: 'employee',
    help: 'Single primary owner; use applicableTo for a multi-employee KPI.',
  },
  { name: 'period', label: 'Period', placeholder: 'Q1 2026 / FY 25-26' },
  { name: 'target_value', label: 'Target', type: 'number', required: true, placeholder: '100' },
  { name: 'actual_value', label: 'Actual', type: 'number', placeholder: '0', defaultValue: '0' },
  {
    name: 'unit',
    label: 'Unit',
    type: 'select',
    options: [
      { value: '%', label: '% (percentage)' },
      { value: '$', label: '$ (currency)' },
      { value: 'count', label: 'Count' },
    ],
    defaultValue: '%',
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'on-track', label: 'On track' },
      { value: 'behind', label: 'Behind' },
      { value: 'achieved', label: 'Achieved' },
    ],
    defaultValue: 'on-track',
  },
];

export const sections = [
  {
    title: 'Definition',
    fieldNames: ['kpi_name', 'formula', 'department_id', 'employee_id'],
  },
  {
    title: 'Targets',
    fieldNames: ['period', 'target_value', 'actual_value', 'unit', 'status'],
  },
];

// §1E Select migration — consumed by kpi-form.tsx until <EnumFormField> is wired up
export const FREQUENCY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

export const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];
