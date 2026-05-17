/**
 * Website-builder, portfolio, and embed surfaces. All forward to the
 * planned `/v1/builder/*`, `/v1/portfolio/*`, and `/v1/embed/*` Rust
 * crates.
 */

import type { EndpointSpec } from '../types';
import { crudExtendedResource } from '../crud-extended';

const b = (
  module: string,
  resource: string,
  scope: string,
  idParam?: string,
): EndpointSpec[] =>
  crudExtendedResource({
    module,
    resource,
    basePath: `/${module}/${resource}`,
    rustPath: `/v1/${module}/${resource}`,
    scopeRead: `${scope}:read`,
    scopeWrite: `${scope}:write`,
    idParam,
  });

export const builderEndpoints: ReadonlyArray<EndpointSpec> = [
  /* ── Website builder ──────────────────────────────────────────────────── */
  ...b('builder', 'sites', 'builder'),
  ...b('builder', 'pages', 'builder'),
  ...b('builder', 'sections', 'builder'),
  ...b('builder', 'components', 'builder'),
  ...b('builder', 'themes', 'builder'),
  ...b('builder', 'menus', 'builder'),
  ...b('builder', 'forms', 'builder'),
  ...b('builder', 'snippets', 'builder'),
  ...b('builder', 'redirects', 'builder'),
  ...b('builder', 'domains', 'builder'),
  ...b('builder', 'assets', 'builder'),
  ...b('builder', 'publishes', 'builder', 'publishId'),

  /* ── Portfolio ────────────────────────────────────────────────────────── */
  ...b('portfolio', 'profiles', 'portfolio'),
  ...b('portfolio', 'projects', 'portfolio'),
  ...b('portfolio', 'case-studies', 'portfolio', 'caseStudyId'),
  ...b('portfolio', 'testimonials', 'portfolio'),
  ...b('portfolio', 'services', 'portfolio'),

  /* ── Embed widgets ────────────────────────────────────────────────────── */
  ...b('embed', 'widgets', 'embed'),
  ...b('embed', 'snippets', 'embed'),
  ...b('embed', 'themes', 'embed'),
];
