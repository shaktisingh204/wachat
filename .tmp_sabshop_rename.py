import os, sys

ROOT = "/Users/harshkhandelwal/Downloads/sabnode"

REPLACEMENTS = [
    # Mongo collection ids
    ("commerce_storefronts", "sabshop_storefronts"),
    ("commerce_themes", "sabshop_themes"),
    ("commerce_collections", "sabshop_collections"),
    ("commerce_carts", "sabshop_carts"),
    ("commerce_orders", "sabshop_orders"),
    ("commerce_shipping_zones", "sabshop_shipping_zones"),
    ("commerce_tax_rules", "sabshop_tax_rules"),
    ("commerce_checkouts", "sabshop_checkouts"),
    # entity_kind audit strings (singular)
    ("commerce_storefront", "sabshop_storefront"),
    ("commerce_theme", "sabshop_theme"),
    ("commerce_collection", "sabshop_collection"),
    ("commerce_cart", "sabshop_cart"),
    ("commerce_order", "sabshop_order"),
    ("commerce_shipping_zone", "sabshop_shipping_zone"),
    ("commerce_tax_rule", "sabshop_tax_rule"),
    ("commerce_checkout", "sabshop_checkout"),
    # Kebab-case crate names
    ("commerce-storefronts", "sabshop-storefronts"),
    ("commerce-themes", "sabshop-themes"),
    ("commerce-collections", "sabshop-collections"),
    ("commerce-carts", "sabshop-carts"),
    ("commerce-orders", "sabshop-orders"),
    ("commerce-shipping-zones", "sabshop-shipping-zones"),
    ("commerce-tax-rules", "sabshop-tax-rules"),
    ("commerce-checkouts", "sabshop-checkouts"),
    # API URL paths
    ("/v1/commerce/", "/v1/sabshop/"),
    # TS API symbols
    ("commerceStorefrontsApi", "sabshopStorefrontsApi"),
    ("commerceThemesApi", "sabshopThemesApi"),
    ("commerceCollectionsApi", "sabshopCollectionsApi"),
    ("commerceCartsApi", "sabshopCartsApi"),
    ("commerceOrdersApi", "sabshopOrdersApi"),
    ("commerceShippingZonesApi", "sabshopShippingZonesApi"),
    ("commerceTaxRulesApi", "sabshopTaxRulesApi"),
    ("commerceCheckoutsApi", "sabshopCheckoutsApi"),
    # TS types Commerce* -> Sabshop*
    ("CommerceStorefront", "SabshopStorefront"),
    ("CommerceTheme", "SabshopTheme"),
    ("CommerceCollection", "SabshopCollection"),
    ("CommerceCart", "SabshopCart"),
    ("CommerceOrder", "SabshopOrder"),
    ("CommerceShippingZone", "SabshopShippingZone"),
    ("CommerceTaxRule", "SabshopTaxRule"),
    ("CommerceCheckout", "SabshopCheckout"),
    ("CommerceActionResult", "SabshopActionResult"),
    # Doc comments / branding text
    ("Commerce storefront", "SabShop storefront"),
    ("Commerce storefronts", "SabShop storefronts"),
    ("Commerce theme", "SabShop theme"),
    ("Commerce themes", "SabShop themes"),
    ("Commerce product collections", "SabShop product collections"),
    ("Commerce product", "SabShop product"),
    ("Commerce shopping carts", "SabShop shopping carts"),
    ("Commerce orders", "SabShop orders"),
    ("Commerce order", "SabShop order"),
    ("Commerce shipping zones", "SabShop shipping zones"),
    ("Commerce tax rules", "SabShop tax rules"),
    ("Commerce in-progress", "SabShop in-progress"),
    ("Commerce — admin", "SabShop — admin"),
    ("Commerce — ", "SabShop — "),
    ("Commerce engine", "SabShop engine"),
    # imports
    ("@/lib/commerce/", "@/lib/sabshop/"),
    ("@/app/actions/commerce.actions", "@/app/actions/sabshop.actions"),
    ("'./commerce.actions'", "'./sabshop.actions'"),
    ('"./commerce.actions"', '"./sabshop.actions"'),
    ("rust-client/commerce-storefronts", "rust-client/sabshop-storefronts"),
    ("rust-client/commerce-themes", "rust-client/sabshop-themes"),
    ("rust-client/commerce-collections", "rust-client/sabshop-collections"),
    ("rust-client/commerce-carts", "rust-client/sabshop-carts"),
    ("rust-client/commerce-orders", "rust-client/sabshop-orders"),
    ("rust-client/commerce-shipping-zones", "rust-client/sabshop-shipping-zones"),
    ("rust-client/commerce-tax-rules", "rust-client/sabshop-tax-rules"),
    ("rust-client/commerce-checkouts", "rust-client/sabshop-checkouts"),
]

TARGETS = []

for c in ("storefronts","themes","collections","carts","orders","shipping-zones","tax-rules","checkouts"):
    base = os.path.join(ROOT, f"rust/crates/sabshop-{c}")
    for dp, dns, fns in os.walk(base):
        for fn in fns:
            if fn.endswith((".rs", ".toml")):
                TARGETS.append(os.path.join(dp, fn))

for c in ("storefronts","themes","collections","carts","orders","shipping-zones","tax-rules","checkouts"):
    TARGETS.append(os.path.join(ROOT, f"src/lib/rust-client/sabshop-{c}.ts"))

TARGETS.append(os.path.join(ROOT, "src/app/actions/sabshop.actions.ts"))
TARGETS.append(os.path.join(ROOT, "src/app/actions/storefront.actions.ts"))

dashboard_shop_files = [
    "src/app/dashboard/shop/page.tsx",
    "src/app/dashboard/shop/new/page.tsx",
    "src/app/dashboard/shop/[storefrontId]/page.tsx",
    "src/app/dashboard/shop/[storefrontId]/products/page.tsx",
    "src/app/dashboard/shop/[storefrontId]/shipping/page.tsx",
    "src/app/dashboard/shop/[storefrontId]/taxes/page.tsx",
    "src/app/dashboard/shop/[storefrontId]/orders/page.tsx",
    "src/app/dashboard/shop/[storefrontId]/orders/[orderId]/page.tsx",
    "src/app/dashboard/shop/[storefrontId]/collections/page.tsx",
    "src/app/dashboard/shop/[storefrontId]/themes/page.tsx",
]
for f in dashboard_shop_files:
    TARGETS.append(os.path.join(ROOT, f))

for dp, dns, fns in os.walk(os.path.join(ROOT, "src/lib/sabshop")):
    for fn in fns:
        if fn.endswith((".ts", ".tsx")):
            TARGETS.append(os.path.join(dp, fn))

changed_files = []
missing_files = []
for path in TARGETS:
    if not os.path.exists(path):
        missing_files.append(path)
        continue
    with open(path, "r", encoding="utf-8") as f:
        orig = f.read()
    new = orig
    for a, b in REPLACEMENTS:
        new = new.replace(a, b)
    if new != orig:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new)
        changed_files.append(path)

print(f"changed={len(changed_files)} missing={len(missing_files)} total_targets={len(TARGETS)}")
for p in missing_files:
    print("MISSING:", p)
