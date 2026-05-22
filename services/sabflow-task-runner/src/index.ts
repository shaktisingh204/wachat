import 'dotenv/config';
import express, { Request, Response } from 'express';
import { z } from 'zod';
import { spawn } from 'child_process';

const DEFAULT_PORT = 4004;
const port = Number(process.env.SABFLOW_TASK_RUNNER_PORT || DEFAULT_PORT);

const app = express();
app.use(express.json());

const RunRequestSchema = z.object({
  language: z.enum(['python']),
  code: z.string(),
  vars: z.record(z.unknown()).default({}),
});

app.post('/run', (req: Request, res: Response) => {
  try {
    const body = RunRequestSchema.parse(req.body);
    if (body.language !== 'python') {
      res.status(400).json({ error: 'Unsupported language' });
      return;
    }

    const varsBase64 = Buffer.from(JSON.stringify(body.vars)).toString('base64');

    // Wrap user code to inject vars and print output as JSON
    const script = `
import json
import sys
import base64

vars_json = base64.b64decode('${varsBase64}').decode('utf-8')
vars = json.loads(vars_json)

def user_code():
${body.code.split('\n').map((line: string) => '    ' + line).join('\n')}

try:
    result = user_code()
    print("===RESULT===")
    print(json.dumps(result))
except Exception as e:
    print("===ERROR===")
    print(str(e), file=sys.stderr)
    sys.exit(1)
`;

    const child = spawn('python3', ['-c', script]);
    
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code: number | null) => {
      if (code !== 0) {
        res.status(500).json({ error: 'Execution failed', stderr });
        return;
      }

      const parts = stdout.split('===RESULT===\n');
      if (parts.length > 1) {
        try {
          const resultJson = parts[1].trim();
          const result = JSON.parse(resultJson);
          res.json({ result, stdout: parts[0] });
          return;
        } catch (e) {
          res.status(500).json({ error: 'Failed to parse JSON result', stdout });
          return;
        }
      }
      res.json({ result: null, stdout });
    });

  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`[sabflow-task-runner] listening on :${port}`);
});
