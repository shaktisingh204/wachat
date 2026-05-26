import re

with open('src/app/sabsms/analytics/deliverability/client.tsx', 'r') as f:
    content = f.read()

content = content.replace("export default function DeliverabilityPage() {", "export default function DeliverabilityPage({ dlrTrendData, volumeVsDlrData, failureCodeData, regionalPerformanceData, tableDataTemplateDLR }: any) {")

content = re.sub(r"// Extended mock data[\s\S]*?(?=export default function DeliverabilityPage)", """
const chartConfig = {
  twilio: { label: "Twilio", color: "hsl(var(--chart-1))" },
  vonage: { label: "Vonage", color: "hsl(var(--chart-2))" },
  plivo: { label: "Plivo", color: "hsl(var(--chart-3))" },
  sinch: { label: "Sinch", color: "hsl(var(--chart-4))" },
};
const COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6"];
""", content)

with open('src/app/sabsms/analytics/deliverability/client.tsx', 'w') as f:
    f.write(content)
