/**
 * CRM accounting surface — chart of accounts, budgets, loans, petty cash,
 * vouchers, reconciliation, payment accounts, currencies, taxes.
 */

import type { EndpointSpec } from '../types';
import { crudExtendedResource } from '../crud-extended';

export const crmAccountingEndpoints: ReadonlyArray<EndpointSpec> = [
  ...crudExtendedResource({
    module: 'crm',
    resource: 'chart-of-accounts',
    basePath: '/crm/chart-of-accounts',
    rustPath: '/v1/crm/chart-of-accounts',
    scopeRead: 'crm:accounting:read',
    scopeWrite: 'crm:accounting:write',
    idParam: 'chartOfAccountId',
  }),
  ...crudExtendedResource({
    module: 'crm',
    resource: 'account-groups',
    basePath: '/crm/account-groups',
    rustPath: '/v1/crm/account-groups',
    scopeRead: 'crm:accounting:read',
    scopeWrite: 'crm:accounting:write',
    idParam: 'accountGroupId',
  }),
  ...crudExtendedResource({
    module: 'crm',
    resource: 'budgets',
    basePath: '/crm/budgets',
    rustPath: '/v1/crm/budgets',
    scopeRead: 'crm:accounting:read',
    scopeWrite: 'crm:accounting:write',
  }),
  ...crudExtendedResource({
    module: 'crm',
    resource: 'loans',
    basePath: '/crm/loans',
    rustPath: '/v1/crm/loans',
    scopeRead: 'crm:hr:read',
    scopeWrite: 'crm:hr:write',
  }),
  ...crudExtendedResource({
    module: 'crm',
    resource: 'petty-cash',
    basePath: '/crm/petty-cash',
    rustPath: '/v1/crm/petty-cash',
    scopeRead: 'crm:accounting:read',
    scopeWrite: 'crm:accounting:write',
    idParam: 'pettyCashId',
  }),
  ...crudExtendedResource({
    module: 'crm',
    resource: 'vouchers',
    basePath: '/crm/vouchers',
    rustPath: '/v1/crm/vouchers',
    scopeRead: 'crm:accounting:read',
    scopeWrite: 'crm:accounting:write',
  }),
  ...crudExtendedResource({
    module: 'crm',
    resource: 'reconciliation',
    basePath: '/crm/reconciliation',
    rustPath: '/v1/crm/reconciliation',
    scopeRead: 'crm:accounting:read',
    scopeWrite: 'crm:accounting:write',
    idParam: 'reconciliationId',
    display: 'reconciliations',
  }),
  ...crudExtendedResource({
    module: 'crm',
    resource: 'payment-accounts',
    basePath: '/crm/payment-accounts',
    rustPath: '/v1/crm/payment-accounts',
    scopeRead: 'crm:accounting:read',
    scopeWrite: 'crm:accounting:write',
    idParam: 'paymentAccountId',
  }),
  ...crudExtendedResource({
    module: 'crm',
    resource: 'currencies',
    basePath: '/crm/currencies',
    rustPath: '/v1/crm/currencies',
    scopeRead: 'crm:accounting:read',
    scopeWrite: 'crm:accounting:write',
  }),
  ...crudExtendedResource({
    module: 'crm',
    resource: 'pt-slabs',
    basePath: '/crm/pt-slabs',
    rustPath: '/v1/crm/pt-slabs',
    scopeRead: 'crm:accounting:read',
    scopeWrite: 'crm:accounting:write',
    idParam: 'ptSlabId',
  }),
];
