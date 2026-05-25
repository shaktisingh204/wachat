import os

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

bounds = {}
for comp in components:
    bounds[comp] = get_component_bounds(comp)

# Create shared file
shared_imports = "".join(lines[0:bounds["fmtCurrency"][0]])

with open("_components/shared.tsx", "w") as f:
    f.write(shared_imports)
    f.write("\n")
    for comp in ["fmtCurrency", "fmtDate", "startOfNDaysAgo", "StatusBadge", "ViewSwitcher", "Field", "ToggleRow"]:
        s, e = bounds[comp]
        f.write("export " + "".join(lines[s:e+1]))
        f.write("\n")

# Need to copy shared imports to the top of all these files too? Yes, but it's easier to just use a template.
# Let's write a smarter Python script that includes necessary imports for each file.
