import os
import shutil

crates = [
    ("sabvault-secrets", "sabvault_secrets", "SabvaultSecret", "secret", "secrets", "secretId", "secret_id"),
    ("sabvault-shares", "sabvault_shares", "SabvaultShare", "share", "shares", "shareId", "share_id"),
    ("sabvault-breach-alerts", "sabvault_breach_alerts", "SabvaultBreachAlert", "alert", "alerts", "alertId", "alert_id"),
]

template_dir = "/Users/harshkhandelwal/Downloads/sabnode/rust/crates/sabcheckout-plans"
base_dir = "/Users/harshkhandelwal/Downloads/sabnode/rust/crates"

def replace_in_file(filepath, replacements):
    with open(filepath, 'r') as f:
        content = f.read()
    
    for old, new in replacements:
        content = content.replace(old, new)
        
    with open(filepath, 'w') as f:
        f.write(content)

for crate_name, rust_pkg_name, struct_name, singular, plural, id_camel, id_snake in crates:
    target_dir = os.path.join(base_dir, crate_name)
    if os.path.exists(target_dir):
        shutil.rmtree(target_dir)
    shutil.copytree(template_dir, target_dir)
    
    replacements = [
        ("sabcheckout-plans", crate_name),
        ("sabcheckout_plans", rust_pkg_name),
        ("SabcheckoutPlan", struct_name),
        ("sabcheckout_plan", f"sabvault_{singular}"),
        ("planId", id_camel),
        ("plan_id", id_snake),
        ("create_plan", f"create_{singular}"),
        ("get_plan", f"get_{singular}"),
        ("update_plan", f"update_{singular}"),
        ("delete_plan", f"delete_{singular}"),
        ("list_plans", f"list_{plural}"),
        ("CreatePlanInput", f"Create{struct_name}Input"),
        ("UpdatePlanInput", f"Update{struct_name}Input"),
        ("CreatePlanResponse", f"Create{struct_name}Response"),
        ("DeletePlanResponse", f"Delete{struct_name}Response"),
        ("plan_from_create", f"{singular}_from_create"),
        ("plan", singular),
        ("plans", plural),
        ("Plan", struct_name),
    ]
    
    for root, dirs, files in os.walk(target_dir):
        for file in files:
            if file.endswith((".rs", ".toml")):
                filepath = os.path.join(root, file)
                replace_in_file(filepath, replacements)
                
print("Done scaffolding SabVault crates.")
