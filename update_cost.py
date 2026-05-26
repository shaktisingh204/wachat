import re

with open('src/app/sabsms/analytics/cost/client.tsx', 'r') as f:
    content = f.read()

# Replace export default function CostAnalyticsPage() with export default function CostAnalyticsPage(props: any)
# Replace the mock data declarations with props usages.
content = content.replace("export default function CostAnalyticsPage() {", "export default function CostAnalyticsPage({ spendTrendsData, providerPerformance, providerSpendPie, countrySpend, campaignSpend }: any) {")

# Remove the mock data declarations from lines 75-123
content = re.sub(r"// ==========================================\n// MOCK DATA \(Expanded for Bulky UI\)\n// ==========================================[\s\S]*?// ==========================================\n// CHART CONFIGS", "// ==========================================\n// CHART CONFIGS", content)

with open('src/app/sabsms/analytics/cost/client.tsx', 'w') as f:
    f.write(content)

