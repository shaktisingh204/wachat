#!/usr/bin/env python3
"""Register the new wachat rust-client modules into the src/lib/rust-client/index.ts barrel.

Idempotent: adds an `import { wachatXApi } from './wachat-x';` and a
`wachatX: wachatXApi,` entry in the `rustClient` object for each module, skipping
any already present. Run from the repo root.
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
INDEX = os.path.join(ROOT, "src/lib/rust-client/index.ts")

MODULES = [
    "wachat-canned-messages", "wachat-ai-training", "wachat-interactive-builder",
    "wachat-setup-kb", "wachat-ads-roadmap", "wachat-quality-history",
    "wachat-flow-events", "wachat-opt-out-settings", "wachat-ab-testing",
    "wachat-contact-merge", "wachat-auto-reply-settings", "wachat-project-agents",
    "wachat-project-attributes", "wachat-link-generator", "wachat-widget-tracking",
    "wachat-integrations-hub", "wachat-razorpay", "wachat-post-generator",
    "wachat-contacts-export-sync", "wachat-number-routing",
]

IMPORT_ANCHOR = "import { wachatContactsApi } from './wachat-contacts';\n"
ENTRY_ANCHOR = "    wachatContacts: wachatContactsApi,\n"


def camel(mod):  # wachat-canned-messages -> wachatCannedMessages
    parts = mod.split("-")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def main():
    t = open(INDEX).read()
    if IMPORT_ANCHOR not in t or ENTRY_ANCHOR not in t:
        raise SystemExit("anchors not found in index.ts")
    # only register modules whose file actually exists
    present = [m for m in MODULES if os.path.exists(os.path.join(ROOT, f"src/lib/rust-client/{m}.ts"))]
    missing = [m for m in MODULES if m not in present]
    if missing:
        print("WARN: module files not found (skipped):", ", ".join(missing))

    imports = "".join(
        f"import {{ {camel(m)}Api }} from './{m}';\n"
        for m in present if f"from './{m}';" not in t
    )
    entries = "".join(
        f"    {camel(m)}: {camel(m)}Api,\n"
        for m in present if f"{camel(m)}: {camel(m)}Api," not in t
    )
    t = t.replace(IMPORT_ANCHOR, IMPORT_ANCHOR + imports, 1)
    t = t.replace(ENTRY_ANCHOR, ENTRY_ANCHOR + entries, 1)
    open(INDEX, "w").write(t)
    print(f"registered {len([1 for m in present if f'{camel(m)}: ' ])} modules; "
          f"+{imports.count(chr(10))} imports, +{entries.count(chr(10))} entries")


if __name__ == "__main__":
    main()
