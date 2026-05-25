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

imports_end = bounds["fmtCurrency"][0]
base_imports = "".join(lines[0:imports_end])

# Let's fix fmtDate
def fix_fmt_date(code):
    return code.replace("d.toLocaleString()", "d.toISOString().replace('T', ' ').substring(0, 16) + ' UTC'")

def write_file(filename, comps, types=[]):
    with open(f"_components/{filename}", "w") as f:
        f.write(base_imports)
        f.write("import { fmtCurrency, fmtDate, startOfNDaysAgo, StatusBadge, ViewSwitcher, Field, ToggleRow } from './shared';\n\n")
        
        for t in types:
            s, e = -1, -1
            for i, line in enumerate(lines):
                if line.startswith(f"type {t}") or line.startswith(f"interface {t}") or line.startswith(f"export interface {t}"):
                    s = i
                    break
            if s != -1:
                ob = 0
                for i in range(s, len(lines)):
                    ob += lines[i].count('{')
                    ob -= lines[i].count('}')
                    if ob == 0 and '{' in ''.join(lines[s:i+1]):
                        e = i
                        break
                f.write("".join(lines[s:e+1]))
                f.write("\n\n")

        for comp in comps:
            s, e = bounds[comp]
            if s != -1:
                code = "".join(lines[s:e+1])
                code = code.replace("function " + comp, "export function " + comp)
                f.write(code)
                f.write("\n\n")

# Shared
with open("_components/shared.tsx", "w") as f:
    f.write(base_imports)
    for comp in ["fmtCurrency", "fmtDate", "startOfNDaysAgo", "StatusBadge", "ViewSwitcher", "Field", "ToggleRow"]:
        s, e = bounds[comp]
        if s != -1:
            code = "".join(lines[s:e+1])
            code = code.replace("function " + comp, "export function " + comp)
            if comp == "fmtDate":
                code = fix_fmt_date(code)
            f.write(code)
            f.write("\n\n")

write_file("payments.tsx", ["PaymentsSection"], ["PaymentsSectionProps"])
write_file("invoices.tsx", ["InvoicesSection"], ["InvoicesSectionProps"])
write_file("templates.tsx", ["TemplatesSection", "TemplateDrawer", "SendInvoiceDialog"], ["TemplatesSectionProps"])
write_file("providers.tsx", ["ProvidersSection", "ProviderDrawer"], ["ProvidersSectionProps"])

