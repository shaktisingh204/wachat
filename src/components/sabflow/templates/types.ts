import type * as React from 'react';
import type {
  Group,
  Edge,
  Variable,
  SabFlowEvent,
  SabFlowTheme,
} from '@/lib/sabflow/types';

/**
 * Categories used to filter templates in the picker.
 * Keep this list tight — the FlowTemplates UI shows a chip per category.
 */
export type TemplateCategory =
  | 'Marketing'
  | 'Support'
  | 'Sales'
  | 'HR'
  | 'E-commerce'
  | 'Health'
  | 'Other';

/**
 * A hydrated template — the full graph data used when the user clicks
 * "Use template".  Returned fresh from `build()` so every instantiation gets
 * its own unique IDs.
 */
export type TemplateInstance = {
  groups: Group[];
  edges: Edge[];
  variables: Variable[];
  events: SabFlowEvent[];
  theme: SabFlowTheme;
  settings: Record<string, unknown>;
};

/**
 * Static metadata for a template, plus a lazy `build()` that returns a fresh
 * `TemplateInstance` with unique IDs every call.
 */
export type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  category: TemplateCategory;
  build: () => TemplateInstance;
};
