#!/usr/bin/env bash
# ui-debt-scan.sh — measures progress toward the single-design-system goal:
# every SabNode element uses ONLY @/components/sabcrm/20ui, no design CSS
# outside that folder, no visual inline styles. Run from repo root.
#
#   bash scripts/ui-debt-scan.sh            # summary counts
#   bash scripts/ui-debt-scan.sh --list     # also list the offending files
#
# In-scope = the authenticated product app + admin + public (/p,/share,/embed)
# + canvas chrome. OUT of scope (excluded below): the 20ui system itself, the
# zoruui library internals (retired in Phase E), the marketing/landing tier,
# and documented third-party CSS (sabflow/typebot, react-big-calendar).
set -euo pipefail
cd "$(dirname "$0")/.."

LIST="${1:-}"

# Paths excluded from "usage" counts (the systems themselves + out-of-scope tiers).
EXCL='src/components/sabcrm/20ui/|src/components/zoruui/|src/components/ui/|src/components/clay|src/components/sab-ui|src/app/\(landing|src/app/features/|src/app/pricing/|src/app/blog/|src/app/partners/|src/app/about-us/|src/app/customers/|src/app/resources/|src/app/enterprise/|src/app/how-it-works/|src/app/compare/'

scan_imports() {
  grep -rlE "from ['\"](@/components/(zoruui|ui|clay|sab-ui)|wabasimplify)" src \
    --include="*.tsx" --include="*.ts" 2>/dev/null | grep -vE "$EXCL" || true
}

# Design CSS outside the 20ui folder. Allowed exceptions: zoruui.css (retired
# Phase E) + third-party canvas CSS (sabflow, react-big-calendar overrides).
scan_css() {
  find src -name "*.css" 2>/dev/null \
    | grep -vE "src/components/sabcrm/20ui/" \
    | grep -vE "src/styles/zoruui.css|sabflow|react-big-calendar|storefront" || true
}

scan_inline() {
  grep -rlF 'style={{' src --include="*.tsx" 2>/dev/null \
    | grep -vE "src/components/sabcrm/20ui/|src/components/zoruui/" || true
}

imports=$(scan_imports); css=$(scan_css); inline=$(scan_inline)
ci=$(printf '%s' "$imports" | grep -c . || true)
cc=$(printf '%s' "$css"     | grep -c . || true)
cl=$(printf '%s' "$inline"  | grep -c . || true)

echo "=============================================="
echo " 20ui consolidation — UI debt scan"
echo "=============================================="
printf " %-44s %s\n" "files importing zoruui/ui/clay/sab-ui:" "$ci"
printf " %-44s %s\n" "design CSS files outside /20ui:"          "$cc"
printf " %-44s %s\n" "files with inline style={{ :"             "$cl"
echo "----------------------------------------------"
printf " %-44s %s\n" "TOTAL debt files:" "$((ci + cc + cl))"
echo "=============================================="

if [ "$LIST" = "--list" ]; then
  echo; echo "## forbidden imports ($ci):"; printf '%s\n' "$imports"
  echo; echo "## design CSS outside /20ui ($cc):"; printf '%s\n' "$css"
  echo; echo "## inline styles ($cl):"; printf '%s\n' "$inline"
fi

# Exit non-zero while debt remains (usable as a CI gate once at zero).
[ "$((ci + cc + cl))" -eq 0 ]
