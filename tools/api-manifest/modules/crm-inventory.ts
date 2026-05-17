/**
 * CRM inventory + manufacturing — items, warehouses, stock adjustments,
 * brands, product categories, products, fixed assets, BOM, production
 * orders.
 */

import type { EndpointSpec } from '../types';
import { crudResource } from '../crud-template';

export const crmInventoryEndpoints: ReadonlyArray<EndpointSpec> = [
  ...crudResource({
    module: 'crm',
    resource: 'items',
    basePath: '/crm/items',
    rustPath: '/v1/crm/items',
    scopeRead: 'crm:inventory:read',
    scopeWrite: 'crm:inventory:write',
  }),
  ...crudResource({
    module: 'crm',
    resource: 'warehouses',
    basePath: '/crm/warehouses',
    rustPath: '/v1/crm/warehouses',
    scopeRead: 'crm:inventory:read',
    scopeWrite: 'crm:inventory:write',
  }),
  ...crudResource({
    module: 'crm',
    resource: 'stock-adjustments',
    basePath: '/crm/stock-adjustments',
    rustPath: '/v1/crm/stock-adjustments',
    scopeRead: 'crm:inventory:read',
    scopeWrite: 'crm:inventory:write',
    idParam: 'stockAdjustmentId',
  }),
  ...crudResource({
    module: 'crm',
    resource: 'brands',
    basePath: '/crm/brands',
    rustPath: '/v1/crm/brands',
    scopeRead: 'crm:inventory:read',
    scopeWrite: 'crm:inventory:write',
  }),
  ...crudResource({
    module: 'crm',
    resource: 'product-categories',
    basePath: '/crm/product-categories',
    rustPath: '/v1/crm/product-categories',
    scopeRead: 'crm:inventory:read',
    scopeWrite: 'crm:inventory:write',
    idParam: 'productCategoryId',
  }),
  ...crudResource({
    module: 'crm',
    resource: 'products',
    basePath: '/crm/products',
    rustPath: '/v1/crm/products',
    scopeRead: 'crm:inventory:read',
    scopeWrite: 'crm:inventory:write',
  }),
  ...crudResource({
    module: 'crm',
    resource: 'fixed-assets',
    basePath: '/crm/fixed-assets',
    rustPath: '/v1/crm/fixed-assets',
    scopeRead: 'crm:accounting:read',
    scopeWrite: 'crm:accounting:write',
    idParam: 'fixedAssetId',
  }),
  ...crudResource({
    module: 'crm',
    resource: 'bom',
    basePath: '/crm/bom',
    rustPath: '/v1/crm/bom',
    scopeRead: 'crm:inventory:read',
    scopeWrite: 'crm:inventory:write',
    idParam: 'bomId',
    display: 'BOM entries',
  }),
  ...crudResource({
    module: 'crm',
    resource: 'production-orders',
    basePath: '/crm/production-orders',
    rustPath: '/v1/crm/production-orders',
    scopeRead: 'crm:inventory:read',
    scopeWrite: 'crm:inventory:write',
    idParam: 'productionOrderId',
  }),
];
