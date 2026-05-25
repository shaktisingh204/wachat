import os
import re

with open("page.tsx", "r") as f:
    lines = f.readlines()

def get_component_bounds(comp_name):
    start_idx = -1
    for i, line in enumerate(lines):
        if line.startswith(f"function {comp_name}") or line.startswith(f"export default function {comp_name}"):
            start_idx = i
            break
    
    if start_idx == -1:
        return -1, -1

    open_braces = 0
    end_idx = -1
    for i in range(start_idx, len(lines)):
        open_braces += lines[i].count('{')
        open_braces -= lines[i].count('}')
        if open_braces == 0 and '{' in ''.join(lines[start_idx:i+1]):
            end_idx = i
            break

    return start_idx, end_idx

components = [
    "fmtCurrency", "fmtDate", "startOfNDaysAgo", "StatusBadge", "ViewSwitcher", 
    "TelegramPaymentsPage", "PaymentsSection", "InvoicesSection", 
    "TemplatesSection", "TemplateDrawer", "Field", "ToggleRow", 
    "SendInvoiceDialog", "ProvidersSection", "ProviderDrawer"
]

for comp in components:
    s, e = get_component_bounds(comp)
    print(f"{comp}: {s+1} - {e+1}")

