# sabnode-template-cli

Scaffold a new SabFlow template package.

## Usage

```bash
npx sabnode-template init my-template
```

Generates a directory `templates-incoming/my-template/` containing:

- `template.json` — id / displayName / description / category / requiredCredentials / screenshots
- `flow.json` — trigger + nodes + edges + variables (a minimal valid SabFlow)
- `verification.json` — declarative test input the CI verifier consumes
- `README.md` — authoring checklist

## Options

| Flag | Default | Description |
| --- | --- | --- |
| `--dir <path>` | `templates-incoming` | Output directory. |
| `--category <cat>` | `ops` | One of `sales`, `marketing`, `support`, `ops`, `finance`, `crm`, `whatsapp`, `ecommerce`, `ads`, `onboarding`. |
| `--force` | _off_ | Overwrite existing files. |
| `-h, --help` | — | Show help. |

## Local fallback (no npm install)

The repo ships an identical script that runs from a checkout:

```bash
node scripts/sabflow/template-init.mjs my-template
```

Both entry points share the same scaffold output.
