/**
 * Forge block: FTP / SFTP
 *
 * Source: n8n-master/packages/nodes-base/nodes/Ftp/Ftp.node.ts
 * Credential type: 'ftp' (expects { host, port?, username, password, useSftp }).
 *
 * Operations covered:
 *   - file.upload     PUT bytes to a remote path
 *   - file.download   GET bytes from a remote path
 *   - file.list       List a directory
 *
 * Deferred:
 *   - rename / move / delete / mkdir actions (re-add when first user asks)
 *   - Binary stream piping — the first port reads/writes a UTF-8 string
 */

/// <reference path="../../../../../../types/forge-drivers.d.ts" />
import type { Client as FtpClient } from 'basic-ftp';
import type SftpClient from 'ssh2-sftp-client';
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asBoolean, asNumber, asString, requireCredential } from '../_shared/http';
import { uploadStreamToSabFiles } from '../_shared/sabfiles';

type FtpCredential = {
  host: string;
  port?: number;
  username: string;
  password: string;
  useSftp: boolean;
};

function readCred(ctx: ForgeActionContext): FtpCredential {
  const cred = requireCredential('FTP', ctx.credential);
  const host = cred.host;
  if (!host) throw new Error('FTP: credential is missing `host`');
  return {
    host,
    port: asNumber(cred.port),
    username: cred.username ?? '',
    password: cred.password ?? '',
    useSftp: asBoolean(cred.useSftp),
  };
}

async function withSftp<T>(
  ctx: ForgeActionContext,
  fn: (client: SftpClient) => Promise<T>,
): Promise<T> {
  const cred = readCred(ctx);
  // Hide from Turbopack/webpack static analysis: ssh2-sftp-client pulls in
  // ssh2 + cpu-features native bindings the bundler can't ship.
  const dyn = new Function('m', 'return import(m)') as (s: string) => Promise<unknown>;
  const mod = (await dyn('ssh2-sftp-client')) as unknown as {
    default?: new () => SftpClient;
  } & (new () => SftpClient);
  const SftpCtor = (mod.default ?? mod) as new () => SftpClient;
  const client = new SftpCtor();
  try {
    await client.connect({
      host: cred.host,
      port: cred.port ?? 22,
      username: cred.username,
      password: cred.password,
    });
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function withFtp<T>(
  ctx: ForgeActionContext,
  fn: (client: FtpClient) => Promise<T>,
): Promise<T> {
  const cred = readCred(ctx);
  const { Client: FtpClientCtor } = await import('basic-ftp');
  const client = new FtpClientCtor();
  try {
    await client.access({
      host: cred.host,
      port: cred.port ?? 21,
      user: cred.username,
      password: cred.password,
    });
    return await fn(client);
  } finally {
    try {
      client.close();
    } catch {
      /* ignore */
    }
  }
}

async function fileUpload(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const path = asString(ctx.options.path);
  const body = asString(ctx.options.body);
  if (!path) throw new Error('FTP: path is required');

  if (cred.useSftp) {
    await withSftp(ctx, async (client) => {
      await client.put(Buffer.from(body, 'utf-8'), path);
    });
  } else {
    const { Readable } = await import('node:stream');
    await withFtp(ctx, async (client) => {
      // basic-ftp uploadFrom accepts a Readable; use a minimal one.
      await client.uploadFrom(Readable.from([Buffer.from(body, 'utf-8')]), path);
    });
  }
  return { outputs: { path, status: 'uploaded' }, logs: [`FTP upload → ${path}`] };
}

async function fileDownload(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const path = asString(ctx.options.path);
  if (!path) throw new Error('FTP: path is required');

  let body = '';
  if (cred.useSftp) {
    body = await withSftp(ctx, async (client) => {
      const buf = await client.get(path);
      return Buffer.isBuffer(buf) ? buf.toString('utf-8') : String(buf);
    });
  } else {
    const { Writable } = await import('node:stream');
    body = await withFtp(ctx, async (client) => {
      const chunks: Buffer[] = [];
      const sink = new Writable({
        write(chunk: Buffer, _enc: BufferEncoding, cb: (err?: Error | null) => void) {
          chunks.push(chunk);
          cb();
        },
      });
      await client.downloadTo(sink, path);
      return Buffer.concat(chunks).toString('utf-8');
    });
  }
  const buf = Buffer.from(body, 'utf-8');
  const name = path.split('/').pop() || 'download';
  const sabFile = await uploadStreamToSabFiles(
    ctx,
    name,
    'application/octet-stream',
    buf,
    buf.length
  );

  return { 
    outputs: { 
      fileId: sabFile.id,
      fileName: sabFile.name,
      contentType: sabFile.mime,
      contentLength: sabFile.size,
      path 
    }, 
    logs: [`FTP download → SabFiles ${sabFile.id} (${buf.length} bytes)`] 
  };
}

async function fileList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const path = asString(ctx.options.path) || '/';
  let entries: unknown[] = [];

  if (cred.useSftp) {
    entries = await withSftp(ctx, async (client) => (await client.list(path)) ?? []);
  } else {
    entries = await withFtp(ctx, async (client) => (await client.list(path)) ?? []);
  }
  return { outputs: { entries, count: entries.length }, logs: [`FTP list → ${entries.length}`] };
}

const block: ForgeBlock = {
  id: 'forge_ftp',
  name: 'FTP / SFTP',
  description: 'Transfer files over FTP or SFTP.',
  iconName: 'LuFolderUp',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'ftp' },
  actions: [
    {
      id: 'file_upload',
      label: 'Upload file',
      description: 'Upload the body to a remote path.',
      fields: [
        { id: 'path', label: 'Remote path', type: 'text', required: true },
        { id: 'body', label: 'File body', type: 'textarea', required: true },
      ],
      run: fileUpload,
    },
    {
      id: 'file_download',
      label: 'Download file',
      description: 'Download the file at a remote path.',
      fields: [
        { id: 'path', label: 'Remote path', type: 'text', required: true },
      ],
      run: fileDownload,
    },
    {
      id: 'file_list',
      label: 'List directory',
      description: 'List entries in a remote directory.',
      fields: [
        { id: 'path', label: 'Remote directory', type: 'text', defaultValue: '/' },
      ],
      run: fileList,
    },
  ],
};

registerForgeBlock(block);
export default block;
