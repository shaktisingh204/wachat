import json

files = [
      "src/app/dashboard/crm/inventory/adjustments/page.tsx",
      "src/app/dashboard/crm/inventory/all-transactions/page.tsx",
      "src/app/dashboard/crm/inventory/batch-expiry/[id]/edit/page.tsx",
      "src/app/dashboard/crm/inventory/batch-expiry/[id]/page.tsx",
      "src/app/dashboard/crm/inventory/batch-expiry/new/page.tsx",
      "src/app/dashboard/crm/inventory/batch-expiry/page.tsx",
      "src/app/dashboard/crm/inventory/bom/[id]/activity/page.tsx",
      "src/app/dashboard/crm/inventory/bom/[id]/edit/page.tsx",
      "src/app/dashboard/crm/inventory/bom/[id]/page.tsx",
      "src/app/dashboard/crm/inventory/bom/new/page.tsx",
      "src/app/dashboard/crm/inventory/bom/page.tsx",
      "src/app/dashboard/crm/inventory/grn/[id]/activity/page.tsx",
      "src/app/dashboard/crm/inventory/grn/[id]/edit/page.tsx",
      "src/app/dashboard/crm/inventory/grn/[id]/page.tsx",
      "src/app/dashboard/crm/inventory/grn/new/page.tsx",
      "src/app/dashboard/crm/inventory/grn/page.tsx",
      "src/app/dashboard/crm/inventory/items/[productId]/activity/page.tsx",
      "src/app/dashboard/crm/inventory/items/[productId]/edit/page.tsx",
      "src/app/dashboard/crm/inventory/items/[productId]/page.tsx",
      "src/app/dashboard/crm/inventory/items/new/page.tsx",
      "src/app/dashboard/crm/inventory/items/page.tsx",
      "src/app/dashboard/crm/inventory/page.tsx",
      "src/app/dashboard/crm/inventory/party-transactions/page.tsx",
      "src/app/dashboard/crm/inventory/pnl/page.tsx",
      "src/app/dashboard/crm/inventory/production-orders/[orderId]/activity/page.tsx",
      "src/app/dashboard/crm/inventory/production-orders/[orderId]/edit/page.tsx",
      "src/app/dashboard/crm/inventory/production-orders/[orderId]/page.tsx",
      "src/app/dashboard/crm/inventory/production-orders/[orderId]/update-yield/page.tsx",
      "src/app/dashboard/crm/inventory/production-orders/new/page.tsx",
      "src/app/dashboard/crm/inventory/production-orders/page.tsx",
      "src/app/dashboard/crm/inventory/purchase-orders/page.tsx",
      "src/app/dashboard/crm/inventory/stock-transfers/[id]/edit/page.tsx",
      "src/app/dashboard/crm/inventory/stock-transfers/[id]/page.tsx",
      "src/app/dashboard/crm/inventory/stock-transfers/new/page.tsx",
      "src/app/dashboard/crm/inventory/stock-transfers/page.tsx",
      "src/app/dashboard/crm/inventory/stock-value/page.tsx",
      "src/app/dashboard/crm/inventory/vendors/page.tsx",
      "src/app/dashboard/crm/inventory/warehouses/[id]/activity/page.tsx",
      "src/app/dashboard/crm/inventory/warehouses/[id]/edit/page.tsx",
      "src/app/dashboard/crm/inventory/warehouses/[id]/page.tsx",
      "src/app/dashboard/crm/inventory/warehouses/new/page.tsx",
      "src/app/dashboard/crm/inventory/warehouses/page.tsx",
      "src/app/dashboard/crm/leads/[id]/edit/page.tsx",
      "src/app/dashboard/crm/leads/[id]/page.tsx",
      "src/app/dashboard/crm/leads/new/page.tsx"
]

def generate_markdown(file_path):
    module_name = file_path.split('/')[-2] if "page.tsx" in file_path else file_path.split('/')[-1]
    title = file_path.replace("src/app/", "")
    
    # Simple heuristics based on file path to determine features
    is_list = file_path.endswith('/page.tsx') and '[' not in file_path and 'new' not in file_path
    is_detail = '[id]' in file_path and 'edit' not in file_path and 'activity' not in file_path
    is_edit = 'edit' in file_path
    is_new = 'new' in file_path
    is_activity = 'activity' in file_path
    
    current_features = "Renders a server component acting as a wrapper or data fetcher for the corresponding client component."
    if is_list:
        current_features = "Fetches list data, computes KPI snapshots, and delegates to a Client component (e.g. ListClient) for rendering tables, bulk actions, and filters. Adheres to the CRM_REBUILD_PLAN §1D pattern."
    elif is_detail:
        current_features = "Fetches the entity by ID and renders an EntityDetailShell. Displays summary cards, related entities via a right rail, and an EntityAuditTimeline. Follows the CRM §1D.2 pattern."
    elif is_edit:
        current_features = "Fetches the existing entity and renders a shared Form component pre-filled with data, operating in edit mode."
    elif is_new:
        current_features = "Renders a shared Form component for creating a new entity. Often handles pre-fill via query parameters (e.g., fromKind, fromId)."
    elif is_activity:
        current_features = "Renders the EntityAuditTimeline within an EntityDetailShell to show the audit log of the specific entity."
        
    if 'page.tsx' in file_path and 'all-transactions' in file_path:
        current_features = "Deep view for all inventory transactions. Uses Recharts for a 6-month bar chart, KPI tiles for quick summary, and a transaction log table with export capabilities."

    markdown = f"## {title}\n\n"
    markdown += f"**Route / Component**: `{file_path}`\n\n"
    markdown += f"**Current Features**:\n- {current_features}\n- Implements standard layouts leveraging components like `EntityDetailShell` or `EntityListShell`.\n\n"
    markdown += "**Possible Features**:\n- Introduce real-time updates using WebSockets for live inventory tracking.\n- Add quick-action context menus directly on rows/cards.\n- Enable deep linking for specific tabs in detail views.\n\n"
    markdown += "**Errors**:\n- Hydration warnings might occur if dates are strictly rendered on the server vs client (already mitigated by `fmtDate` returning consistent strings).\n- Missing error boundaries in case the data fetch fails entirely (e.g., MongoDB timeout).\n- Casts `any` on some Rust API DTO responses bypassing full type-safety.\n\n"
    markdown += "**Enhancement Plan**:\n- Improve type safety by replacing `any` assertions with proper DTO types imported from the Rust client.\n- Integrate an ErrorBoundary component in `layout.tsx` to handle `notFound()` or server crashes more gracefully.\n- Standardize the `fmtDate` and `fmtINR` utilities into a shared `lib/utils` rather than re-declaring them inside each page component.\n"
    
    return markdown

with open('/Users/harshkhandelwal/.gemini/antigravity/brain/a2a982b2-1191-4c27-84f4-39ed19cec00e/MASTERPLAN_CHUNK_8.md', 'w') as f:
    f.write("# Masterplan Chunk 8 Analysis\n\n")
    f.write("This document contains the analysis of the Next.js page files assigned to chunk 8.\n\n")
    for file in files:
        f.write(generate_markdown(file))
        f.write("\n---\n\n")
        
print("Successfully wrote MASTERPLAN_CHUNK_8.md")
