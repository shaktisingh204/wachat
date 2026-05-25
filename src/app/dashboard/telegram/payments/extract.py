import os

with open("page.tsx", "r") as f:
    lines = f.readlines()

def get_component_bounds(comp_name):
    start_idx = -1
    for i, line in enumerate(lines):
        if line.startswith(f"function {comp_name}") or line.startswith(f"export default function {comp_name}") or line.startswith(f"export function {comp_name}") or line.startswith(f"export type {comp_name}") or line.startswith(f"interface {comp_name}") or line.startswith(f"type {comp_name}"):
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

# First 171 lines are imports and types.
imports = "".join(lines[0:171])

def write_comp(filename, comps, extra_types=[]):
    with open(f"_components/{filename}", "w") as f:
        f.write(imports)
        # Import shared components if needed
        # f.write("import { fmtCurrency, fmtDate, startOfNDaysAgo, StatusBadge, Field, ToggleRow } from './shared';\n\n")
        f.write("import { fmtCurrency, fmtDate, startOfNDaysAgo, StatusBadge, ViewSwitcher, Field, ToggleRow } from './shared';\n\n")
        
        for t in extra_types:
            s, e = -1, -1
            # find type definition
            for i, line in enumerate(lines):
                if line.startswith(f"type {t}") or line.startswith(f"interface {t}"):
                    s = i
                    break
            if s != -1:
                # count braces
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
            s, e = get_component_bounds(comp)
            if s != -1:
                f.write("export " + "".join(lines[s:e+1]))
                f.write("\n\n")

write_comp("payments.tsx", ["PaymentsSection"], ["PaymentsSectionProps"])
write_comp("invoices.tsx", ["InvoicesSection"], ["InvoicesSectionProps"])
write_comp("templates.tsx", ["TemplatesSection", "TemplateDrawer", "SendInvoiceDialog"])
write_comp("providers.tsx", ["ProvidersSection", "ProviderDrawer"])

