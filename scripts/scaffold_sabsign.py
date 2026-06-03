import os
import subprocess

CRATES = [
    "sabsign-envelopes",
    "sabsign-templates",
    "sabsign-audit",
    "sabsign-form-builder",
    "sabsign-signer",
    "sabsign-notary",
    "sabsign-integrations",
    "sabsign-settings"
]

BASE_DIR = "/Users/harshkhandelwal/Downloads/sabnode/rust"
CRATES_DIR = os.path.join(BASE_DIR, "crates")

for crate in CRATES:
    crate_path = os.path.join(CRATES_DIR, crate)
    if not os.path.exists(crate_path):
        subprocess.run(["cargo", "new", "--lib", crate], cwd=CRATES_DIR, check=True)
        print(f"Created crate {crate}")

cargo_toml_path = os.path.join(BASE_DIR, "Cargo.toml")
with open(cargo_toml_path, "r") as f:
    lines = f.readlines()

new_lines = []
inserted = False
for line in lines:
    if line.strip() == "]":
        if not any(f'"{crate}"' in l for l in lines):
            for crate in CRATES:
                new_lines.append(f'    "crates/{crate}",\n')
            inserted = True
    new_lines.append(line)

if inserted:
    with open(cargo_toml_path, "w") as f:
        f.writelines(new_lines)
    print("Updated Cargo.toml")
