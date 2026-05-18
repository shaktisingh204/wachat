# __DISPLAY_NAME__

> SabFlow template — `__NAME__` (category: `__CATEGORY__`)

## Description

TODO — describe what this template does, who it's for, and what credentials are needed.

## What's in this package

- `template.json` — listing metadata (id, displayName, description, category, requiredCredentials, screenshots).
- `flow.json` — the actual flow definition (trigger + nodes + edges + variables).
- `verification.json` — declarative test input the CI verifier consumes.
- `README.md` — this file.

## Authoring checklist

- [ ] Fill in `template.json` → `description`, `requiredCredentials`, `screenshots`, `tags`, `author`.
- [ ] Replace the placeholder block(s) in `flow.json` with the real flow.
- [ ] Add at least one realistic test case to `verification.json`.
- [ ] Run the local verifier (`npm run sabflow:verify-template -- __NAME__`) before opening a PR.

## How to author

1. Build the flow visually inside SabFlow.
2. Export the flow JSON from the canvas (Settings → Export).
3. Paste it into `flow.json` here.
4. Add screenshots under `public/templates/__NAME__/` and reference them in `template.json`.
5. Open a PR — the CI template verifier runs against `verification.json`.
