// Ambient type stubs for SabFlow forge driver packages that ship without
// TypeScript types. These are intentionally minimal — only the surface area
// the forge blocks actually use is described. They are NOT @types/* packages
// (project-local only) and should not be relied on outside the forge blocks.

declare module 'pg' {
  export class Client {
    constructor(opts: Record<string, unknown>);
    connect(): Promise<void>;
    end(): Promise<void>;
    query(
      text: string,
      params?: unknown[],
    ): Promise<{ rows: unknown[]; rowCount: number | null }>;
  }
  const _default: { Client: typeof Client };
  export default _default;
}

declare module 'ssh2-sftp-client' {
  class SftpClient {
    constructor();
    connect(opts: Record<string, unknown>): Promise<void>;
    end(): Promise<void>;
    put(data: Buffer, remote: string): Promise<unknown>;
    get(remote: string): Promise<Buffer | string>;
    list(remote: string): Promise<unknown[]>;
  }
  export default SftpClient;
}

declare module 'ldapjs' {
  export interface LdapSearchEntry {
    object?: unknown;
    pojo?: unknown;
  }
  export interface LdapSearchResponse {
    on(ev: 'searchEntry', cb: (entry: LdapSearchEntry) => void): void;
    on(ev: 'error', cb: (err: Error) => void): void;
    on(ev: 'end', cb: () => void): void;
  }
  export interface LdapClient {
    bind(dn: string, password: string, cb: (err: Error | null) => void): void;
    unbind(cb?: (err?: Error) => void): void;
    search(
      base: string,
      opts: Record<string, unknown>,
      cb: (err: Error | null, res: LdapSearchResponse) => void,
    ): void;
    compare(
      dn: string,
      attr: string,
      value: string,
      cb: (err: Error | null, matched: boolean) => void,
    ): void;
  }
  export function createClient(opts: Record<string, unknown>): LdapClient;
}
