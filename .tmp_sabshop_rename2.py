import os

ROOT = "/Users/harshkhandelwal/Downloads/sabnode"

# Doc-comment branding in the 8 rust-client TS files + leftover Commerce* types
RC_REPLACEMENTS = [
    ("Commerce Cart client", "SabShop Cart client"),
    ("Commerce Checkout client", "SabShop Checkout client"),
    ("Commerce Shipping Zone client", "SabShop Shipping Zone client"),
    ("Commerce Collection client", "SabShop Collection client"),
    ("Commerce Storefront client", "SabShop Storefront client"),
    ("Commerce Tax Rule client", "SabShop Tax Rule client"),
    ("Commerce Order client", "SabShop Order client"),
    ("Commerce Theme client", "SabShop Theme client"),
    # Remaining Commerce-prefixed TS types in rust-clients
    ("CommerceShippingRate", "SabshopShippingRate"),
    ("CommercePaymentStatus", "SabshopPaymentStatus"),
    ("CommerceFulfillmentStatus", "SabshopFulfillmentStatus"),
]

rc_files = [
    "src/lib/rust-client/sabshop-storefronts.ts",
    "src/lib/rust-client/sabshop-themes.ts",
    "src/lib/rust-client/sabshop-collections.ts",
    "src/lib/rust-client/sabshop-carts.ts",
    "src/lib/rust-client/sabshop-orders.ts",
    "src/lib/rust-client/sabshop-shipping-zones.ts",
    "src/lib/rust-client/sabshop-tax-rules.ts",
    "src/lib/rust-client/sabshop-checkouts.ts",
    # actions file for the TODO(commerce) doc comment
    "src/app/actions/sabshop.actions.ts",
]

ACT_REPLACEMENTS = [
    ("TODO(commerce):", "TODO(sabshop):"),
    ("`commerce` permission key", "`sabshop` permission key"),
    ("Commerce — admin", "SabShop — admin"),
]

count = 0
for rel in rc_files:
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        print("MISSING", path); continue
    with open(path, "r", encoding="utf-8") as f:
        orig = f.read()
    new = orig
    reps = RC_REPLACEMENTS if rel.startswith("src/lib/rust-client/") else ACT_REPLACEMENTS
    for a, b in reps:
        new = new.replace(a, b)
    if rel == "src/app/actions/sabshop.actions.ts":
        for a, b in ACT_REPLACEMENTS:
            new = new.replace(a, b)
    if new != orig:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new)
        count += 1
print(f"changed={count}")
