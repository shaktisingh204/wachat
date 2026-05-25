import os

files = [
    "src/app/portal/client/invoices/[id]/page.tsx",
    "src/app/portal/client/invoices/page.tsx",
    "src/app/portal/client/estimates/page.tsx",
    "src/app/portal/client/projects/[id]/page.tsx"
]
base_dir = "/Users/harshkhandelwal/Downloads/sabnode"

for rel_path in files:
    abs_path = os.path.join(base_dir, rel_path)
    with open(abs_path, 'r') as f:
        c = f.read()
    
    # Remove the leftover catch { return String(n); } } block
    bad_string = """ catch {
        return String(n);
    }
}"""
    bad_string2 = """ catch {
        return String(n);
    }
}
"""
    c = c.replace(bad_string2, "")
    c = c.replace(bad_string, "")
    
    with open(abs_path, 'w') as f:
        f.write(c)
