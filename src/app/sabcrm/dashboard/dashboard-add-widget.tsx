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
 * Pure `.st-*` dialog/field primitives — no ZoruUI / Tailwind.
 */

import * as React from 'react';
import { X } from 'lucide-react';

import { TwentyButton } from '@/components/sabcrm/twenty';
import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';

import {
  WIDGET_TYPES,
  WIDGET_TYPE_LABEL,
  type WidgetTypeTw,
  type DashboardWidgetTw,
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
    const config: Record<string, unknown> = { object: objectSlug, metric };
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

  return (
    <div
      className="st-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Add widget"
      onClick={onClose}
    >
      <form
        className="st-dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">Add widget</h2>
          <button
            type="button"
            className="st-dialog__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="st-dialog__body">
          {/* Widget type */}
          <div className="st-field">
            <label className="st-field__label" htmlFor="aw-type">
              Widget type
            </label>
            <div className="st-widget-typegrid" id="aw-type" role="radiogroup">
              {WIDGET_TYPES.map((t) => (
                <button
                  type="button"
                  key={t}
                  role="radio"
                  aria-checked={type === t}
                  className={`st-widget-typeopt${type === t ? ' active' : ''}`}
                  onClick={() => setType(t)}
                >
                  {WIDGET_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Object */}
          <div className="st-field">
            <label className="st-field__label" htmlFor="aw-object">
              Object
            </label>
            <select
              id="aw-object"
              className="st-select"
              value={objectSlug}
              onChange={(e) => setObjectSlug(e.target.value)}
            >
              {objects.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.labelPlural}
                </option>
              ))}
            </select>
          </div>

          {/* Metric */}
          {metrics.length > 1 ? (
            <div className="st-field">
              <label className="st-field__label" htmlFor="aw-metric">
                Metric
              </label>
              <select
                id="aw-metric"
                className="st-select"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              >
                {metrics.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Group / category / date field */}
          {needsField ? (
            <div className="st-field">
              <label className="st-field__label" htmlFor="aw-field">
                {metric === 'timeSeries' ? 'Date field' : 'Group by field'}
              </label>
              <select
                id="aw-field"
                className="st-select"
                value={field}
                onChange={(e) => setField(e.target.value)}
              >
                {fieldOptions.length === 0 ? (
                  <option value="">No compatible field</option>
                ) : (
                  fieldOptions.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))
                )}
              </select>
            </div>
          ) : null}

          {/* Numeric field to sum */}
          {needsSumField ? (
            <div className="st-field">
              <label className="st-field__label" htmlFor="aw-sumfield">
                Value field (to sum)
              </label>
              <select
                id="aw-sumfield"
                className="st-select"
                value={sumField}
                onChange={(e) => setSumField(e.target.value)}
              >
                {numericOptions.length === 0 ? (
                  <option value="amount">amount</option>
                ) : (
                  numericOptions.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))
                )}
              </select>
            </div>
          ) : null}

          {/* Title */}
          <div className="st-field">
            <label className="st-field__label" htmlFor="aw-title">
              Title
            </label>
            <input
              id="aw-title"
              className="st-input"
              type="text"
              value={title}
              placeholder={defaultTitle}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>

        <div className="st-dialog__footer">
          <TwentyButton variant="ghost" onClick={onClose}>
            Cancel
          </TwentyButton>
          <TwentyButton variant="primary" type="submit">
            Add widget
          </TwentyButton>
        </div>
      </form>
    </div>
  );
}
