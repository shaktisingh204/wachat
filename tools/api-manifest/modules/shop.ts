/**
 * Shop / custom-ecommerce surface.
 */

import type { EndpointSpec } from '../types';
import { crudExtendedResource } from '../crud-extended';

const sh = (
  resource: string,
  idParam?: string,
  display?: string,
): EndpointSpec[] =>
  crudExtendedResource({
    module: 'shop',
    resource,
    basePath: `/shop/${resource}`,
    rustPath: `/v1/shop/${resource}`,
    scopeRead: 'shop:read',
    scopeWrite: 'shop:write',
    idParam,
    display,
  });

export const shopEndpoints: ReadonlyArray<EndpointSpec> = [
  ...sh('storefronts', 'storefrontId'),
  ...sh('products'),
  ...sh('product-variants', 'productVariantId'),
  ...sh('collections'),
  ...sh('orders', 'orderId'),
  ...sh('carts'),
  ...sh('checkouts'),
  ...sh('customers'),
  ...sh('addresses'),
  ...sh('shipping-methods', 'shippingMethodId'),
  ...sh('shipping-zones', 'shippingZoneId'),
  ...sh('payment-methods', 'paymentMethodId'),
  ...sh('discounts'),
  ...sh('refunds'),
  ...sh('reviews'),
  ...sh('wishlists'),
  ...sh('abandoned-carts', 'abandonedCartId'),
  ...sh('inventory-locations', 'inventoryLocationId'),
];
