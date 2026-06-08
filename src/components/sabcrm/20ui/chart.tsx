'use client';

/**
 * 20ui — Chart primitives (recharts v3, skinned to tokens).
 *
 * These are the *reusable* container / tooltip / legend wrappers — they never
 * render a concrete chart type. Compose them with recharts series of your own:
 *
 *   <ChartContainer config={config} className="h-64">
 *     <LineChart data={data}>
 *       <CartesianGrid vertical={false} />
 *       <XAxis dataKey="month" tickLine={false} axisLine={false} />
 *       <ChartTooltip content={<ChartTooltipContent />} />
 *       <ChartLegend content={<ChartLegendContent />} />
 *       <Line dataKey="revenue" stroke="var(--color-revenue)" />
 *       <Line dataKey="expenses" stroke="var(--color-expenses)" />
 *     </LineChart>
 *   </ChartContainer>
 *
 * The `config` ({ [seriesKey]: { label, color, icon? } }) drives two things:
 *   1. ChartStyle injects `--color-<key>` CSS vars scoped to this chart instance,
 *      so series read their colour from `stroke="var(--color-revenue)"` etc.
 *   2. ChartTooltipContent / ChartLegendContent resolve human labels + icons
 *      from the same config, keyed by the series dataKey/name.
 *
 * Colours in `config` should be 20ui tokens (e.g. `var(--st-accent)`,
 * `var(--u-brand-orange)`) so charts stay on-system in both light and dark.
 *
 * Mirrors the shadcn/ui20 chart API (ChartContainer, ChartTooltip,
 * ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle) but is a
 * clean 20ui reimplementation — token-styled, no Tailwind, accessible labels.
 */

import * as React from 'react';
import * as Recharts from 'recharts';

import { renderIcon, type IconProp } from './_icon';

import './chart.css';

/** Raw recharts namespace, re-exported for charts that compose primitives directly. */
export { Recharts };

/** Quiet greyscale series palette (20ui tokens). Use shape/stroke for separation, not hue. */
export const CHART_PALETTE = [
  'var(--st-text)',
  'var(--st-text-secondary)',
  'var(--st-text-tertiary)',
  'var(--st-border-strong)',
  'var(--st-border)',
] as const;

/* ------------------------------------------------------------------ *
 * Config + context
 * ------------------------------------------------------------------ */

/** Theme selectors mirrored from the design system root. */
const THEMES = { light: '', dark: '.dark, [data-theme="dark"]' } as const;

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
    /** Optional leading glyph in tooltip / legend rows. */
    icon?: IconProp;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

type ChartContextValue = { config: ChartConfig };

const ChartContext = React.createContext<ChartContextValue | null>(null);

function useChart(): ChartContextValue {
  const ctx = React.useContext(ChartContext);
  if (!ctx) {
    throw new Error('useChart must be used within a <ChartContainer />');
  }
  return ctx;
}

function mergeClass(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ *
 * ChartStyle — injects per-instance --color-<key> vars
 * ------------------------------------------------------------------ */

export interface ChartStyleProps {
  /** The unique chart instance id (matches `[data-chart=…]` on the container). */
  id: string;
  config: ChartConfig;
}

/**
 * Emits a scoped <style> mapping each config entry to a `--color-<key>`
 * variable, per theme. Series then reference `var(--color-<key>)`. Renders
 * nothing when no entry carries a colour.
 */
export function ChartStyle({ id, config }: ChartStyleProps): React.JSX.Element | null {
  const colorConfig = Object.entries(config).filter(
    ([, item]) => item.theme || item.color,
  );

  if (!colorConfig.length) {
    return null;
  }

  const css = Object.entries(THEMES)
    .map(([theme, selector]) => {
      const vars = colorConfig
        .map(([key, item]) => {
          const color =
            item.theme?.[theme as keyof typeof item.theme] || item.color;
          return color ? `  --color-${key}: ${color};` : null;
        })
        .filter(Boolean)
        .join('\n');
      // `selector` is '' for light (applies to the bare [data-chart]) and a
      // theme selector for dark; both are prefixes onto the instance attribute.
      const prefix = selector ? `${selector} ` : '';
      return `${prefix}[data-chart="${id}"] {\n${vars}\n}`;
    })
    .join('\n');

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

/* ------------------------------------------------------------------ *
 * ChartContainer
 * ------------------------------------------------------------------ */

export interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config: ChartConfig;
  /** A single recharts chart element (LineChart, BarChart, PieChart, …). */
  children: React.ComponentProps<typeof Recharts.ResponsiveContainer>['children'];
}

/**
 * Wraps a recharts chart in a responsive, token-styled surface and supplies the
 * `ChartConfig` via context. Defaults to a 16:9 box; constrain it with a height
 * class / style (e.g. `className="h-64"` or `style={{ height: 280 }}`).
 */
export const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  function ChartContainer({ id, className, children, config, ...rest }, ref) {
    const reactId = React.useId();
    const chartId = `chart-${(id ?? reactId).replace(/[:]/g, '')}`;

    return (
      <ChartContext.Provider value={{ config }}>
        <div
          ref={ref}
          data-chart={chartId}
          className={mergeClass('u-chart', className)}
          {...rest}
        >
          <ChartStyle id={chartId} config={config} />
          <Recharts.ResponsiveContainer>{children}</Recharts.ResponsiveContainer>
        </div>
      </ChartContext.Provider>
    );
  },
);

/* ------------------------------------------------------------------ *
 * Tooltip
 * ------------------------------------------------------------------ */

/** Pass-through recharts Tooltip; give it `content={<ChartTooltipContent />}`. */
export const ChartTooltip = Recharts.Tooltip;

export interface ChartTooltipContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  payload?: ChartPayloadItem[];
  label?: unknown;
  /** Indicator glyph next to each series row. */
  indicator?: 'dot' | 'line' | 'dashed';
  hideLabel?: boolean;
  hideIndicator?: boolean;
  labelKey?: string;
  nameKey?: string;
  labelClassName?: string;
  /** Force a single indicator colour (else taken from the payload). */
  color?: string;
  labelFormatter?: (
    value: React.ReactNode,
    payload: ChartPayloadItem[],
  ) => React.ReactNode;
  formatter?: (
    value: unknown,
    name: unknown,
    item: ChartPayloadItem,
    index: number,
    raw: unknown,
  ) => React.ReactNode;
}

interface ChartPayloadItem {
  value?: number | string;
  name?: string;
  dataKey?: string | number;
  color?: string;
  payload?: Record<string, unknown> & { fill?: string };
  [key: string]: unknown;
}

/** Token-styled custom tooltip body. Resolves labels/colours from ChartConfig. */
export const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  ChartTooltipContentProps
>(function ChartTooltipContent(
  {
    active,
    payload,
    label,
    indicator = 'dot',
    hideLabel = false,
    hideIndicator = false,
    labelKey,
    nameKey,
    labelClassName,
    color,
    labelFormatter,
    formatter,
    className,
    ...rest
  },
  ref,
) {
  const { config } = useChart();

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null;
    }
    const [item] = payload;
    const key = `${labelKey || item.dataKey || item.name || 'value'}`;
    const itemConfig = getPayloadConfig(config, item, key);
    const value =
      !labelKey && typeof label === 'string'
        ? config[label]?.label ?? label
        : itemConfig?.label;

    if (labelFormatter) {
      return (
        <div className={mergeClass('u-chart-tt__label', labelClassName)}>
          {labelFormatter(value, payload)}
        </div>
      );
    }
    if (!value) {
      return null;
    }
    return (
      <div className={mergeClass('u-chart-tt__label', labelClassName)}>{value}</div>
    );
  }, [hideLabel, payload, labelKey, label, config, labelFormatter, labelClassName]);

  if (!active || !payload?.length) {
    return null;
  }

  const nestLabel = payload.length === 1 && indicator !== 'dot';

  return (
    <div
      ref={ref}
      role="tooltip"
      className={mergeClass('u-chart-tt', className)}
      {...rest}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="u-chart-tt__items">
        {payload.map((item, index) => {
          const key = `${nameKey || item.name || item.dataKey || 'value'}`;
          const itemConfig = getPayloadConfig(config, item, key);
          const indicatorColor =
            color || (item.payload?.fill as string | undefined) || item.color;
          const icon = itemConfig?.icon;

          return (
            <div
              key={`${item.dataKey ?? item.name ?? index}`}
              className={mergeClass(
                'u-chart-tt__row',
                indicator === 'dot' && 'u-chart-tt__row--center',
              )}
            >
              {formatter && item.value !== undefined && item.name ? (
                formatter(item.value, item.name, item, index, item.payload)
              ) : (
                <>
                  {icon ? (
                    renderIcon(icon, { className: 'u-chart-tt__icon', 'aria-hidden': true })
                  ) : (
                    !hideIndicator && (
                      <span
                        aria-hidden="true"
                        className={mergeClass(
                          'u-chart-tt__indicator',
                          `u-chart-tt__indicator--${indicator}`,
                          nestLabel &&
                            indicator === 'dashed' &&
                            'u-chart-tt__indicator--nest',
                        )}
                        style={
                          {
                            '--u-chart-indicator': indicatorColor,
                          } as React.CSSProperties
                        }
                      />
                    )
                  )}
                  <div
                    className={mergeClass(
                      'u-chart-tt__content',
                      nestLabel && 'u-chart-tt__content--nest',
                    )}
                  >
                    <div className="u-chart-tt__name-wrap">
                      {nestLabel ? tooltipLabel : null}
                      <span className="u-chart-tt__name">
                        {itemConfig?.label ?? item.name}
                      </span>
                    </div>
                    {item.value !== undefined && item.value !== null ? (
                      <span className="u-chart-tt__value">
                        {typeof item.value === 'number'
                          ? item.value.toLocaleString()
                          : item.value}
                      </span>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * Legend
 * ------------------------------------------------------------------ */

/** Pass-through recharts Legend; give it `content={<ChartLegendContent />}`. */
export const ChartLegend = Recharts.Legend;

interface ChartLegendItem {
  value?: string;
  dataKey?: string | number;
  color?: string;
  [key: string]: unknown;
}

export interface ChartLegendContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  payload?: ChartLegendItem[];
  verticalAlign?: 'top' | 'middle' | 'bottom';
  hideIcon?: boolean;
  nameKey?: string;
}

/** Token-styled custom legend. Resolves labels/icons/colours from ChartConfig. */
export const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  ChartLegendContentProps
>(function ChartLegendContent(
  { className, payload, verticalAlign = 'bottom', hideIcon = false, nameKey, ...rest },
  ref,
) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={mergeClass(
        'u-chart-legend',
        verticalAlign === 'top' ? 'u-chart-legend--top' : 'u-chart-legend--bottom',
        className,
      )}
      {...rest}
    >
      {payload.map((item, index) => {
        const key = `${nameKey || item.dataKey || 'value'}`;
        const itemConfig = getPayloadConfig(config, item, key);
        const icon = itemConfig?.icon;

        return (
          <div
            key={`${item.value ?? item.dataKey ?? index}`}
            className="u-chart-legend__item"
          >
            {icon && !hideIcon ? (
              renderIcon(icon, { className: 'u-chart-legend__icon', 'aria-hidden': true })
            ) : (
              <span
                aria-hidden="true"
                className="u-chart-legend__swatch"
                style={{ background: item.color }}
              />
            )}
            <span className="u-chart-legend__label">
              {itemConfig?.label ?? item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * Helper — resolve a config entry from a recharts payload row
 * ------------------------------------------------------------------ */

function getPayloadConfig(
  config: ChartConfig,
  payload: unknown,
  key: string,
): ChartConfig[string] | undefined {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }
  const record = payload as Record<string, unknown>;
  const inner =
    'payload' in record &&
    typeof record.payload === 'object' &&
    record.payload !== null
      ? (record.payload as Record<string, unknown>)
      : undefined;

  let configKey = key;
  if (key in record && typeof record[key] === 'string') {
    configKey = record[key] as string;
  } else if (inner && key in inner && typeof inner[key] === 'string') {
    configKey = inner[key] as string;
  }

  return configKey in config ? config[configKey] : config[key];
}

export default ChartContainer;
