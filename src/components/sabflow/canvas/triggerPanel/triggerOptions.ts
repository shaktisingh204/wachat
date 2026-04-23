/**
 * Registry for the trigger picker panel — the n8n-style
 * "What triggers this workflow?" rail that shows on an empty canvas.
 *
 * Each option maps a UX-friendly label/description/icon onto one of the five
 * SabFlowEvent types defined in src/lib/sabflow/types.ts.
 */
import type { ComponentType, SVGProps } from 'react';
import {
  LuMousePointerClick,
  LuClock,
  LuGlobe,
  LuPlay,
  LuTriangleAlert,
} from 'react-icons/lu';

import type { EventType } from '@/lib/sabflow/types';

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

export type TriggerOption = {
  type: EventType;
  label: string;
  description: string;
  icon: IconComponent;
  color: string;
};

export const TRIGGER_OPTIONS: TriggerOption[] = [
  {
    type: 'manual',
    label: 'Trigger manually',
    description: 'Runs the flow on clicking a button. Good for getting started quickly.',
    icon: LuMousePointerClick as IconComponent,
    color: '#f76808',
  },
  {
    type: 'start',
    label: 'When the flow starts',
    description: 'Default entry point — runs whenever a new visitor enters the flow.',
    icon: LuPlay as IconComponent,
    color: '#10b981',
  },
  {
    type: 'schedule',
    label: 'On a schedule',
    description: 'Runs the flow every day, hour, or custom interval.',
    icon: LuClock as IconComponent,
    color: '#3b82f6',
  },
  {
    type: 'webhook',
    label: 'On webhook call',
    description: 'Runs the flow on receiving an HTTP request.',
    icon: LuGlobe as IconComponent,
    color: '#8b5cf6',
  },
  {
    type: 'error',
    label: 'On error',
    description: 'Runs the flow when another flow throws an error.',
    icon: LuTriangleAlert as IconComponent,
    color: '#ef4444',
  },
];
