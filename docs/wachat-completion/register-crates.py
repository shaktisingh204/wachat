#!/usr/bin/env python3
"""Centrally register WaChat-completion crates into the `sabnode-api` crate.

Idempotent: applies the 3 api-side edits for each named crate, skipping any
already present.
  1. rust/crates/api/Cargo.toml      -> `<name> = { path = "../<name>" }`
  2. rust/crates/api/src/state.rs    -> derive-from-mongo `FromRef<AppState>` impl
  3. rust/crates/api/src/router.rs   -> `let <ident> = <ident>::router::<AppState>();`
                                        + `.nest("<mount>", <ident>)` (before the
                                          `/v1/wachat` catch-all)

Usage:
  python3 docs/wachat-completion/register-crates.py wachat-canned-messages wachat-ai-training ...
  (no args = every crate in the registry that is not already `wired`)

Run from the repo root.
"""
import json
import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REG = os.path.join(ROOT, "docs/wachat-completion/crate-registry.json")
CARGO = os.path.join(ROOT, "rust/crates/api/Cargo.toml")
STATE = os.path.join(ROOT, "rust/crates/api/src/state.rs")
ROUTER = os.path.join(ROOT, "rust/crates/api/src/router.rs")

# anchors (must exist — created when wachat-number-routing was wired manually)
CARGO_ANCHOR = 'wachat-number-routing = { path = "../wachat-number-routing" }\n'
STATE_ANCHOR = (
    "impl FromRef<AppState> for wachat_number_routing::WachatNumberRoutingState {\n"
    "    fn from_ref(s: &AppState) -> Self {\n"
    "        wachat_number_routing::WachatNumberRoutingState::new(s.mongo.clone())\n"
    "    }\n}\n"
)
ROUTER_LET_ANCHOR = "    let wachat_number_routing = wachat_number_routing::router::<AppState>();\n"
ROUTER_NEST_ANCHOR = '        .nest("/v1/wachat/number-routing", wachat_number_routing)\n'


def insert_after(text, anchor, additions):
    if anchor not in text:
        raise SystemExit(f"anchor not found:\n{anchor!r}")
    new = [a for a in additions if a not in text]
    if not new:
        return text, 0
    return text.replace(anchor, anchor + "".join(new), 1), len(new)


def main(names):
    reg = json.load(open(REG))["crates"]
    if not names:
        names = [n for n, m in reg.items() if not m.get("wired")]
    for n in names:
        if n not in reg:
            raise SystemExit(f"unknown crate: {n}")

    cargo = open(CARGO).read()
    state = open(STATE).read()
    router = open(ROUTER).read()

    cargo, c1 = insert_after(cargo, CARGO_ANCHOR,
        [f'{n} = {{ path = "../{n}" }}\n' for n in names])

    state, c2 = insert_after(state, STATE_ANCHOR, [
        f"impl FromRef<AppState> for {reg[n]['ident']}::{reg[n]['state']} {{\n"
        f"    fn from_ref(s: &AppState) -> Self {{\n"
        f"        {reg[n]['ident']}::{reg[n]['state']}::new(s.mongo.clone())\n"
        f"    }}\n}}\n"
        for n in names
    ])

    router, c3 = insert_after(router, ROUTER_LET_ANCHOR,
        [f"    let {reg[n]['ident']} = {reg[n]['ident']}::router::<AppState>();\n" for n in names])
    router, c4 = insert_after(router, ROUTER_NEST_ANCHOR,
        [f'        .nest("{reg[n]["mount"]}", {reg[n]["ident"]})\n' for n in names])

    open(CARGO, "w").write(cargo)
    open(STATE, "w").write(state)
    open(ROUTER, "w").write(router)
    print(f"registered: {', '.join(names)}")
    print(f"  Cargo deps +{c1}  FromRef +{c2}  router let +{c3}  nest +{c4}")


if __name__ == "__main__":
    main(sys.argv[1:])
