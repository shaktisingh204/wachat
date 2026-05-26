/**
 * Commerce & Catalog — barrel.
 *
 * Re-exports the public surface of the commerce module. Internal types should
 * be imported from `./types`. Server-only helpers (CRUD, gateway adapters,
 * importers) are re-exported under their submodule namespaces to keep
 * call-sites self-documenting.
 */

export * from './types';

export * as products from './products';
export * as inventory from './inventory';
export * as cart from './cart';
export * as orders from './orders';
export * as payments from './payments';
export * as shipping from './shipping';
export * as loyalty from './loyalty';
export * as giftCards from './gift-cards';
export * as subscriptions from './subscriptions';

export * as shopifyImporter from './imports/shopify';
export * as wooCommerceImporter from './imports/woocommerce';

// Convenience direct re-exports of common factories.
export { getPaymentGateway, listSupportedGateways } from './payments';
export { rateShop, getShippingProvider } from './shipping';
