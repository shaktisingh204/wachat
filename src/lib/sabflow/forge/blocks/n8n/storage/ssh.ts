/**
 * Forge block: SSH
 *
 * Source: n8n-master/packages/nodes-base/nodes/Ssh/Ssh.node.ts
 * Credential type: 'ssh' (expects { host, port?, username, password?, privateKey? }).
 *
 * Operations covered:
 *   - file.upload      sftp.put(local, remote)
 *   - file.download    sftp.get(remote)
 *   - file.list        sftp.list(remote)
 *   - command.execute  ssh exec → stdout/stderr/code
 *
 * Driver note:
 *   `ssh2-sftp-client` is statically imported (installed). The `commandExecute`
 *   action depends on `ssh2`, which is NOT bundled — that path still uses a
 *   dynamic-import safety net so the rest of the block stays functional.
 *
 * Deferred:
 *   - Streamed binary IO — body is a UTF-8 string in the first port
 *   - Long-running sessions, port forwarding
 */

/// <reference path="../../../../../../types/forge-drivers.d.ts" />
import type SftpClient from 'ssh2-sftp-client';
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString, requireCredential } from '../_shared/http';

type SshCredential = {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
};

function readCred(ctx: ForgeActionContext): SshCredential {
  const cred = requireCredential('SSH', ctx.credential);
  if (!cred.host) throw new Error('SSH: credential is missing `host`');
  if (!cred.username) throw new Error('SSH: credential is missing `username`');
  if (!cred.password && !cred.privateKey) {
    throw new Error('SSH: credential must include either a password or a privateKey');
  }
  return {
    host: cred.host,
    port: asNumber(cred.port) ?? 22,
    username: cred.username,
    password: cred.password || undefined,
    privateKey: cred.privateKey || undefined,
  };
}

async function withSftp<T>(
  ctx: ForgeActionContext,
  fn: (client: SftpClient) => Promise<T>,
): Promise<T> {
  const cred = readCred(ctx);
  // Hide the import from Turbopack/webpack static analysis: ssh2-sftp-client
  // brings cpu-features / ssh2 native bindings that the bundler can't ship.
  // Function-constructed dynamic import is invisible to the bundler.
  const dyn = new Function('m', 'return import(m)') as (s: string) => Promise<unknown>;
  const mod = (await dyn('ssh2-sftp-client')) as unknown as {
    default?: new () => SftpClient;
  } & (new () => SftpClient);
  const SftpCtor = (mod.default ?? mod) as new () => SftpClient;
  const client = new SftpCtor();
  try {
    await client.connect({
      host: cred.host,
      port: cred.port,
      username: cred.username,
      password: cred.password,
      privateKey: cred.privateKey,
    });
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function fileUpload(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const path = asString(ctx.options.path);
  const body = asString(ctx.options.body);
  if (!path) throw new Error('SSH: path is required');
  await withSftp(ctx, (client) => client.put(Buffer.from(body, 'utf-8'), path));
  return { outputs: { path, status: 'uploaded' }, logs: [`SSH upload → ${path}`] };
}

async function fileDownload(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const path = asString(ctx.options.path);
  if (!path) throw new Error('SSH: path is required');
  const body = await withSftp(ctx, async (client) => {
    const buf = await client.get(path);
    return Buffer.isBuffer(buf) ? buf.toString('utf-8') : String(buf);
  });
  return { outputs: { body, path }, logs: [`SSH download → ${path} (${body.length} bytes)`] };
}

async function fileList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const path = asString(ctx.options.path) || '/';
  const entries = await withSftp(ctx, (client) => client.list(path));
  return { outputs: { entries, count: entries.length }, logs: [`SSH list → ${entries.length}`] };
}

function ssh2DriverMissing(): Error {
  return new Error(
    'SSH: the `ssh2` driver is not installed. Ask the SabNode admin to run ' +
      '`npm install ssh2` so the SSH command_execute action can run.',
  );
}

async function commandExecute(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const command = asString(ctx.options.command);
  if (!command) throw new Error('SSH: command is required');

  let mod: Record<string, unknown> | undefined;
  try {
    mod = (await import(/* webpackIgnore: true */ 'ssh2' as string)) as Record<string, unknown>;
  } catch {
    throw ssh2DriverMissing();
  }
  type Ssh2Client = {
    on: (event: string, cb: (...args: unknown[]) => void) => Ssh2Client;
    connect: (opts: Record<string, unknown>) => void;
    exec: (cmd: string, cb: (err: Error | undefined, stream: unknown) => void) => void;
    end: () => void;
  };
  const ClientCtor = mod?.Client as new () => Ssh2Client;
  if (!ClientCtor) throw ssh2DriverMissing();

  const conn = new ClientCtor();
  const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>(
    (resolve, reject) => {
      let stdout = '';
      let stderr = '';
      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            reject(err);
            return;
          }
          const s = stream as {
            on: (event: string, cb: (...args: unknown[]) => void) => typeof s;
            stderr: { on: (event: string, cb: (...args: unknown[]) => void) => unknown };
          };
          s.on('close', (code: unknown) => {
            conn.end();
            resolve({
              stdout,
              stderr,
              code: typeof code === 'number' ? code : null,
            });
          }).on('data', (chunk: unknown) => {
            stdout += Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : String(chunk);
          });
          s.stderr.on('data', (chunk: unknown) => {
            stderr += Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : String(chunk);
          });
        });
      });
      conn.on('error', (err: unknown) => reject(err as Error));
      conn.connect({
        host: cred.host,
        port: cred.port,
        username: cred.username,
        password: cred.password,
        privateKey: cred.privateKey,
      });
    },
  );

  return {
    outputs: result,
    logs: [`SSH exec → exit ${result.code ?? '?'} (${result.stdout.length}b stdout, ${result.stderr.length}b stderr)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_ssh',
  name: 'SSH',
  description: 'Run shell commands and transfer files over SSH/SFTP.',
  iconName: 'LuTerminal',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'ssh' },
  actions: [
    {
      id: 'file_upload',
      label: 'Upload file',
      description: 'Upload the body to a remote path via SFTP.',
      fields: [
        { id: 'path', label: 'Remote path', type: 'text', required: true },
        { id: 'body', label: 'File body', type: 'textarea', required: true },
      ],
      run: fileUpload,
    },
    {
      id: 'file_download',
      label: 'Download file',
      description: 'Download a remote file via SFTP.',
      fields: [
        { id: 'path', label: 'Remote path', type: 'text', required: true },
      ],
      run: fileDownload,
    },
    {
      id: 'file_list',
      label: 'List directory',
      description: 'List entries in a remote directory via SFTP.',
      fields: [
        { id: 'path', label: 'Remote directory', type: 'text', defaultValue: '/' },
      ],
      run: fileList,
    },
    {
      id: 'command_execute',
      label: 'Execute command',
      description: 'Run a shell command and capture stdout/stderr/exit code.',
      fields: [
        { id: 'command', label: 'Command', type: 'textarea', required: true, placeholder: 'ls -la' },
      ],
      run: commandExecute,
    },
  ],
};

registerForgeBlock(block);
export default block;
