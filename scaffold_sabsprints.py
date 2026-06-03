import os
import re

base_dir = "/Users/harshkhandelwal/Downloads/sabnode/rust/crates"

with open(os.path.join(base_dir, "scaffold.py"), "r") as f:
    original = f.read()

# Extract templates
cargo_toml_tpl = re.search(r'cargo_toml_tpl = """(.*?)"""', original, re.DOTALL).group(1)
lib_rs_tpl = re.search(r'lib_rs_tpl = """(.*?)"""', original, re.DOTALL).group(1)

targets = [
    {
        "folder": "sabsprints-sprints",
        "package": "sabsprints-sprints",
        "lib": "sabsprints_sprints",
        "collection": "sabsprints_sprints",
        "type": "SabsprintsSprint",
        "single": "sprint",
        "plural": "sprints",
        "Single": "Sprint",
        "Plural": "Sprints"
    },
    {
        "folder": "sabsprints-epics",
        "package": "sabsprints-epics",
        "lib": "sabsprints_epics",
        "collection": "sabsprints_epics",
        "type": "SabsprintsEpic",
        "single": "epic",
        "plural": "epics",
        "Single": "Epic",
        "Plural": "Epics"
    },
    {
        "folder": "sabsprints-velocity",
        "package": "sabsprints-velocity",
        "lib": "sabsprints_velocity",
        "collection": "sabsprints_velocity",
        "type": "SabsprintsVelocity",
        "single": "velocity",
        "plural": "velocities",
        "Single": "Velocity",
        "Plural": "Velocities"
    }
]

for t in targets:
    crate_dir = os.path.join(base_dir, t["folder"])
    src_dir = os.path.join(crate_dir, "src")
    os.makedirs(src_dir, exist_ok=True)
    
    with open(os.path.join(crate_dir, "Cargo.toml"), "w") as f:
        f.write(cargo_toml_tpl.format(**t))
        
    with open(os.path.join(src_dir, "lib.rs"), "w") as f:
        f.write(lib_rs_tpl.format(**t))
