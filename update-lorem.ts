import * as fs from 'fs';

const path = 'src/app/dashboard/seo/tools/lorem-ipsum/page.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { Button, Input, Label, Textarea, cn, Switch } from '@/components/zoruui';",
  "import { Button, Input, Label, Textarea, cn, Switch, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/zoruui';"
);

fs.writeFileSync(path, code);
