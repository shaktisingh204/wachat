const fs = require('fs');
const file = 'src/app/sabsms/analytics/numbers/numbers-analytics-client.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /import {\s+Pause, Archive, Sparkles, AlertTriangle,\s+Share, Calendar, PieChart, ShieldAlert, FileText,\s+Activity, ArrowRight, Settings, Mail\s+} from "lucide-react";/m,
  'import { \n  Pause, Archive, Sparkles, AlertTriangle, \n  Share, PieChart, FileText,\n  Activity, ArrowRight, Settings, Mail\n} from "lucide-react";'
);

fs.writeFileSync(file, content);
