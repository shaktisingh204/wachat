import sys
import os
import re
import json

def analyze_file(filepath):
    if not os.path.exists(filepath):
        return {"error": "File not found"}
        
    with open(filepath, 'r') as f:
        content = f.read()
        
    imports = []
    for match in re.finditer(r'^import\s+.*$', content, re.MULTILINE):
        imports.append(match.group(0))
        
    components = []
    for match in re.finditer(r'(?:export\s+)?(?:default\s+)?function\s+([A-Z][a-zA-Z0-9_]*)', content):
        components.append(match.group(1))
        
    state = []
    for match in re.finditer(r'const\s+\[([a-zA-Z0-9_]+),\s*set[A-Z][a-zA-Z0-9_]*\]\s*=\s*useState', content):
        state.append(match.group(1))
        
    hooks = []
    for match in re.finditer(r'use[A-Z][a-zA-Z0-9_]*', content):
        hooks.append(match.group(0))
        
    ui_elements = []
    for match in re.finditer(r'<([A-Z][a-zA-Z0-9_]*)[^>]*>', content):
        ui_elements.append(match.group(1))
        
    return {
        "imports": imports[:5], # limit to 5
        "components": list(set(components)),
        "state": list(set(state)),
        "hooks": list(set(hooks)),
        "ui": list(set(ui_elements))[:10], # limit to 10
        "size": len(content)
    }

files = [
      "src/app/dashboard/hrm/payroll/salary-structure/[id]/edit/page.tsx",
      "src/app/dashboard/hrm/payroll/salary-structure/[id]/page.tsx",
      "src/app/dashboard/hrm/payroll/salary-structure/new/page.tsx",
      "src/app/dashboard/hrm/payroll/salary-structure/page.tsx",
      "src/app/dashboard/hrm/payroll/settings/page.tsx",
      "src/app/dashboard/hrm/payroll/shift-change-requests/page.tsx",
      "src/app/dashboard/hrm/payroll/shift-rotations/[id]/edit/page.tsx",
      "src/app/dashboard/hrm/payroll/shift-rotations/[id]/page.tsx",
      "src/app/dashboard/hrm/payroll/shift-rotations/automate/page.tsx",
      "src/app/dashboard/hrm/payroll/shift-rotations/new/page.tsx",
      "src/app/dashboard/hrm/payroll/shift-rotations/page.tsx",
      "src/app/dashboard/hrm/payroll/shifts/[id]/edit/page.tsx",
      "src/app/dashboard/hrm/payroll/shifts/[id]/page.tsx",
      "src/app/dashboard/hrm/payroll/shifts/new/page.tsx",
      "src/app/dashboard/hrm/payroll/shifts/page.tsx",
      "src/app/dashboard/hrm/payroll/shifts/schedule/page.tsx",
      "src/app/dashboard/hrm/payroll/tds/[id]/edit/page.tsx",
      "src/app/dashboard/hrm/payroll/tds/[id]/page.tsx",
      "src/app/dashboard/hrm/payroll/tds/new/page.tsx",
      "src/app/dashboard/hrm/payroll/tds/page.tsx",
      "src/app/dashboard/hrm/payroll/time-logs/page.tsx",
      "src/app/dashboard/hrm/payroll/weekly-timesheets/[id]/edit/page.tsx",
      "src/app/dashboard/hrm/payroll/weekly-timesheets/[id]/page.tsx",
      "src/app/dashboard/hrm/payroll/weekly-timesheets/new/page.tsx",
      "src/app/dashboard/hrm/payroll/weekly-timesheets/page.tsx",
      "src/app/dashboard/hrm/permission-groups/[id]/page.tsx",
      "src/app/dashboard/hrm/permission-groups/page.tsx",
      "src/app/dashboard/hrm/portal/page.tsx",
      "src/app/dashboard/hrm/portal/reports/page.tsx",
      "src/app/dashboard/hrm/portal/roadmaps/[id]/edit/page.tsx",
      "src/app/dashboard/hrm/portal/roadmaps/[id]/page.tsx",
      "src/app/dashboard/hrm/portal/roadmaps/new/page.tsx",
      "src/app/dashboard/hrm/portal/roadmaps/page.tsx",
      "src/app/dashboard/hrm-advanced/ats-recruitment/page.tsx",
      "src/app/dashboard/hrm-advanced/benefits-portal/page.tsx",
      "src/app/dashboard/hrm-advanced/employee-onboarding/page.tsx",
      "src/app/dashboard/hrm-advanced/expense-policy/page.tsx",
      "src/app/dashboard/hrm-advanced/geofenced-attendance/page.tsx",
      "src/app/dashboard/hrm-advanced/lms-training/page.tsx",
      "src/app/dashboard/hrm-advanced/offboarding/page.tsx",
      "src/app/dashboard/hrm-advanced/okr-tracking/page.tsx",
      "src/app/dashboard/hrm-advanced/org-chart/page.tsx",
      "src/app/dashboard/hrm-advanced/performance-reviews/page.tsx",
      "src/app/dashboard/information/page.tsx",
      "src/app/dashboard/instagram/connections/page.tsx"
]

results = {}
for f in files:
    results[f] = analyze_file(f)
    
with open('analysis_results.json', 'w') as f:
    json.dump(results, f, indent=2)

print("Done")
