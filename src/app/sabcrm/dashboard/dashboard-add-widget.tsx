'use client';

/**
 * SabCRM saved-dashboard — "Add widget" dialog (Twenty-faithful).
 *
 * Lets the user pick a widget `type`, the source `object`, and a `field` /
 * `metric` to chart. Object + field choices come from `listObjectsAction`
 * metadata so the picker only ever offers real fields. Submitting hands a fully
 * formed `{ id, type, title, config }` widget back to the parent, which persists
 * it via `updateDashboardTw`.
 *
 * Built on 20ui primitives (Modal / Field / Input / Select / SegmentedControl)
 * inside the CRM `.sabcrm-twenty` surface.
 */

import * as React from 'react';

import {
  Modal,
  Field,
  Input,
  SelectField,
  SegmentedControl,
  Button,
} from '@/components/sabcrm/20ui';
import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';

import {
  WIDGET_TYPES,
  WIDGET_TYPE_LABEL,
  type WidgetTypeTw,
  type DashboardWidgetTw,
  type SabcrmWidgetConfig,
} from './dashboard-types';

/** Metric options offered per widget type. */
const METRICS_BY_TYPE: Record<WidgetTypeTw, Array<{ value: string; label: string }>> = {
  kpi: [
    { value: 'count', label: 'Record count' },
    { value: 'sum', label: 'Sum of a number field' },
  ],
  bar: [
    { value: 'count', label: 'Count by field' },
    { value: 'sum', label: 'Sum by field' },
    { value: 'timeSeries', label: 'Count over time (monthly)' },
  ],
  recent: [{ value: 'recent', label: 'Latest records' }],
  pipeline: [{ value: 'sum', label: 'Value by stage' }],
};

/** Which config key the chosen field is written to, per (type, metric). */
function fieldConfigKey(type: WidgetTypeTw, metric: string): string {
  if (type === 'pipeline') return 'groupField';
  if (type === 'kpi' && metric === 'sum') return 'groupField';
  return 'field';
}

/** Field-type filter for the field dropdown, per (type, metric). */
function fieldFilter(
  type: WidgetTypeTw,
  metric: string,
): (f: FieldMetadata) => boolean {
  if (type === 'bar' && metric === 'timeSeries') {
    return (f) => f.type === 'DATE' || f.type === 'DATE_TIME' || f.key === 'createdAt';
  }
  if (metric === 'sum' || type === 'pipeline') {
    // grouping field for sum/pipeline — prefer SELECT-like fields.
    return (f) => f.type === 'SELECT' || f.type === 'MULTI_SELECT' || f.type === 'TEXT';
  }
  // count / kpi-count — group by a categorical field.
  return (f) => f.type === 'SELECT' || f.type === 'MULTI_SELECT' || f.type === 'TEXT';
}

/** Numeric fields, for the "sum field" selector. */
function isNumeric(f: FieldMetadata): boolean {
  return f.type === 'NUMBER' || f.type === 'CURRENCY';
}

function makeId(): string {
  // Lightweight unique id; the action may replace/normalise it server-side.
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export interface AddWidgetDialogProps {
  objects: ObjectMetadata[];
  onClose: () => void;
  onAdd: (widget: DashboardWidgetTw) => void;
}

export function AddWidgetDialog({
  objects,
  onClose,
  onAdd,
}: AddWidgetDialogProps): React.JSX.Element {
  const formId = React.useId();
  const [type, setType] = React.useState<WidgetTypeTw>('kpi');
  const firstObject = objects[0]?.slug ?? 'leads';
  const [objectSlug, setObjectSlug] = React.useState<string>(firstObject);
  const metrics = METRICS_BY_TYPE[type];
  const [metric, setMetric] = React.useState<string>(metrics[0]!.value);
  const [field, setField] = React.useState<string>('');
  const [sumField, setSumField] = React.useState<string>('');
  const [title, setTitle] = React.useState<string>('');

  const activeObject = React.useMemo(
    () => objects.find((o) => o.slug === objectSlug),
    [objects, objectSlug],
  );

  // Reset the metric whenever the type changes (option sets differ).
  React.useEffect(() => {
    setMetric(METRICS_BY_TYPE[type][0]!.value);
  }, [type]);

  const fieldOptions = React.useMemo(() => {
    const fields = activeObject?.fields ?? [];
    return fields.filter(fieldFilter(type, metric));
  }, [activeObject, type, metric]);

  const numericOptions = React.useMemo(
    () => (activeObject?.fields ?? []).filter(isNumeric),
    [activeObject],
  );

  // Keep the field selection valid as the option set changes.
  React.useEffect(() => {
    if (!fieldOptions.some((f) => f.key === field)) {
      setField(fieldOptions[0]?.key ?? '');
    }
  }, [fieldOptions, field]);

  React.useEffect(() => {
    if (!numericOptions.some((f) => f.key === sumField)) {
      setSumField(numericOptions[0]?.key ?? 'amount');
    }
  }, [numericOptions, sumField]);

  const needsField = type !== 'recent';
  const needsSumField =
    metric === 'sum' && (type === 'bar' || type === 'pipeline' || type === 'kpi');

  const defaultTitle = React.useMemo(() => {
    const objLabel = activeObject?.labelPlural ?? objectSlug;
    if (type === 'recent') return `Recent ${objLabel.toLowerCase()}`;
    if (type === 'pipeline') return `${objLabel} pipeline`;
    if (type === 'kpi')
      return metric === 'sum' ? `${objLabel} value` : `Total ${objLabel.toLowerCase()}`;
    return `${objLabel} by ${field || 'field'}`;
  }, [activeObject, objectSlug, type, metric, field]);

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    const config: SabcrmWidgetConfig = { object: objectSlug, metric };
    if (needsField) config[fieldConfigKey(type, metric)] = field;
    if (needsSumField) config.sumField = sumField;
    if (type === 'recent') config.sortBy = 'createdAt';

    onAdd({
      id: makeId(),
      type,
      title: title.trim() || defaultTitle,
      config,
    });
  }

  const fieldSelectOptions =
    fieldOptions.length === 0
      ? [{ value: '', label: 'No compatible field' }]
      : fieldOptions.map((f) => ({ value: f.key, label: f.label }));

  const sumSelectOptions =
    numericOptions.length === 0
      ? [{ value: 'amount', label: 'amount' }]
      : numericOptions.map((f) => ({ value: f.key, label: f.label }));

  return (
    <Modal
      open
      onClose={onClose}
      title="Add widget"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId}>
            Add widget
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit}>
        {/* Widget type */}
        <Field label="Widget type">
          <SegmentedControl<WidgetTypeTw>
            aria-label="Widget type"
            value={type}
            onChange={setType}
            items={WIDGET_TYPES.map((t) => ({
              value: t,
              label: WIDGET_TYPE_LABEL[t],
            }))}
          />
        </Field>

        {/* Object */}
        <Field label="Object">
          <SelectField
            aria-label="Object"
            value={objectSlug}
            onChange={(v) => setObjectSlug(v ?? firstObject)}
            options={objects.map((o) => ({
              value: o.slug,
              label: o.labelPlural,
            }))}
          />
        </Field>

        {/* Metric */}
        {metrics.length > 1 ? (
          <Field label="Metric">
            <SelectField
              aria-label="Metric"
              value={metric}
              onChange={(v) => setMetric(v ?? metrics[0]!.value)}
              options={metrics.map((m) => ({ value: m.value, label: m.label }))}
            />
          </Field>
        ) : null}

        {/* Group / category / date field */}
        {needsField ? (
          <Field label={metric === 'timeSeries' ? 'Date field' : 'Group by field'}>
            <SelectField
              aria-label={metric === 'timeSeries' ? 'Date field' : 'Group by field'}
              value={field}
              onChange={(v) => setField(v ?? '')}
              options={fieldSelectOptions}
            />
          </Field>
        ) : null}

        {/* Numeric field to sum */}
        {needsSumField ? (
          <Field label="Value field (to sum)">
            <SelectField
              aria-label="Value field to sum"
              value={sumField}
              onChange={(v) => setSumField(v ?? 'amount')}
              options={sumSelectOptions}
            />
          </Field>
        ) : null}

        {/* Title */}
        <Field label="Title">
          <Input
            type="text"
            value={title}
            placeholder={defaultTitle}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
