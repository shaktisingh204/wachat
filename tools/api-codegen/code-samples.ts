/**
 * Shared code-sample builder used by both the OpenAPI generator
 * (`x-codeSamples` extension) and the per-endpoint docs generator.
 *
 * Each emitter takes an `EndpointSpec` and returns ready-to-paste source
 * for a single language. Samples favour stdlib clients (no extra deps)
 * so a developer can run them straight away.
 *
 * Adding a language: add an entry to `LANGUAGES` and a `<lang>Sample()`
 * function. The OpenAPI extension and docs page pick them up
 * automatically.
 */

import type { EndpointSpec } from '../api-manifest/types';
import { toOpenApiPath } from './util';

export interface CodeSample {
  /** Human label rendered in the docs tab. */
  lang: string;
  /** Lowercase syntax-highlighter hint (`bash`, `typescript`, `python`, ...). */
  highlight: string;
  source: string;
}

const BASE = 'https://api.sabnode.com/api/v1';
const KEY_ENV = 'SABNODE_API_KEY';

function hasBody(spec: EndpointSpec): boolean {
  return ['POST', 'PATCH', 'PUT'].includes(spec.method);
}

function methodIdent(spec: EndpointSpec): string {
  return [spec.module, spec.verb, spec.resource]
    .join('_')
    .replace(/[-_/]+([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function bodyPlaceholder(): string {
  return '{}';
}

/* ── cURL ──────────────────────────────────────────────────────────────── */

export function curlSample(spec: EndpointSpec): CodeSample {
  const apiPath = toOpenApiPath(spec.path);
  const headers = [
    `-H "Authorization: Bearer $${KEY_ENV}"`,
    hasBody(spec) ? `-H "Content-Type: application/json"` : null,
    spec.idempotent ? `-H "Idempotency-Key: $(uuidgen)"` : null,
  ]
    .filter(Boolean)
    .join(' \\\n  ');
  const body = hasBody(spec) ? ` \\\n  -d '${bodyPlaceholder()}'` : '';
  return {
    lang: 'cURL',
    highlight: 'bash',
    source: `curl -X ${spec.method} "${BASE}${apiPath}" \\\n  ${headers}${body}`,
  };
}

/* ── HTTP / .http file ─────────────────────────────────────────────────── */

export function httpSample(spec: EndpointSpec): CodeSample {
  const apiPath = toOpenApiPath(spec.path);
  const lines = [
    `${spec.method} ${BASE}${apiPath}`,
    `Authorization: Bearer {{${KEY_ENV}}}`,
  ];
  if (hasBody(spec)) {
    lines.push('Content-Type: application/json');
    lines.push('');
    lines.push(bodyPlaceholder());
  }
  return { lang: 'HTTP', highlight: 'http', source: lines.join('\n') };
}

/* ── JavaScript (Node fetch / browser fetch) ──────────────────────────── */

export function jsSample(spec: EndpointSpec): CodeSample {
  const apiPath = toOpenApiPath(spec.path);
  const init: string[] = [`method: '${spec.method}'`, `headers: {
    Authorization: \`Bearer \${process.env.${KEY_ENV}}\`,${
    hasBody(spec) ? `
    'Content-Type': 'application/json',` : ''
  }
  }`];
  if (hasBody(spec)) init.push(`body: JSON.stringify(${bodyPlaceholder()})`);
  return {
    lang: 'JavaScript',
    highlight: 'javascript',
    source: [
      `const res = await fetch('${BASE}${apiPath}', {`,
      `  ${init.join(',\n  ')},`,
      `});`,
      `const data = await res.json();`,
      `console.log(data);`,
    ].join('\n'),
  };
}

/* ── TypeScript SDK ────────────────────────────────────────────────────── */

export function tsSdkSample(spec: EndpointSpec): CodeSample {
  const fn = methodIdent(spec);
  const args: string[] = [];
  for (const p of spec.pathParams ?? []) args.push(`${p.name}: 'xxx'`);
  for (const q of spec.queryParams ?? []) args.push(`${q.name}: 'xxx'`);
  if (hasBody(spec)) args.push('body: { /* ... */ }');
  const argLine = args.length ? `{ ${args.join(', ')} }` : '';
  return {
    lang: 'TypeScript SDK',
    highlight: 'typescript',
    source: [
      `import { SabnodeClient } from '@sabnode/sdk';`,
      ``,
      `const sn = new SabnodeClient({ apiKey: process.env.${KEY_ENV}! });`,
      `const res = await sn.${fn}(${argLine});`,
      `console.log(res.data);`,
    ].join('\n'),
  };
}

/* ── Python (requests) ─────────────────────────────────────────────────── */

export function pythonRequestsSample(spec: EndpointSpec): CodeSample {
  const apiPath = toOpenApiPath(spec.path);
  const lines = [
    'import os, requests',
    '',
    `r = requests.${spec.method.toLowerCase()}(`,
    `    "${BASE}${apiPath}",`,
    `    headers={"Authorization": f"Bearer {os.environ['${KEY_ENV}']}"}${hasBody(spec) ? ',' : ''}`,
  ];
  if (hasBody(spec)) lines.push('    json={},');
  lines.push(')');
  lines.push('r.raise_for_status()');
  lines.push('print(r.json())');
  return { lang: 'Python', highlight: 'python', source: lines.join('\n') };
}

/* ── Python (httpx async) ──────────────────────────────────────────────── */

export function pythonHttpxSample(spec: EndpointSpec): CodeSample {
  const apiPath = toOpenApiPath(spec.path);
  const lines = [
    'import os, httpx, asyncio',
    '',
    'async def main():',
    '    async with httpx.AsyncClient() as client:',
    `        r = await client.${spec.method.toLowerCase()}(`,
    `            "${BASE}${apiPath}",`,
    `            headers={"Authorization": f"Bearer {os.environ['${KEY_ENV}']}"}${hasBody(spec) ? ',' : ''}`,
  ];
  if (hasBody(spec)) lines.push('            json={},');
  lines.push('        )');
  lines.push('        r.raise_for_status()');
  lines.push('        print(r.json())');
  lines.push('');
  lines.push('asyncio.run(main())');
  return { lang: 'Python (async)', highlight: 'python', source: lines.join('\n') };
}

/* ── Go ────────────────────────────────────────────────────────────────── */

export function goSample(spec: EndpointSpec): CodeSample {
  const apiPath = toOpenApiPath(spec.path);
  const lines = [
    'package main',
    '',
    'import (',
    '    "bytes"',
    '    "fmt"',
    '    "io"',
    '    "net/http"',
    '    "os"',
    ')',
    '',
    'func main() {',
  ];
  if (hasBody(spec)) {
    lines.push('    body := bytes.NewBufferString(`{}`)');
    lines.push(`    req, _ := http.NewRequest("${spec.method}", "${BASE}${apiPath}", body)`);
    lines.push('    req.Header.Set("Content-Type", "application/json")');
  } else {
    lines.push(`    req, _ := http.NewRequest("${spec.method}", "${BASE}${apiPath}", nil)`);
  }
  lines.push(`    req.Header.Set("Authorization", "Bearer " + os.Getenv("${KEY_ENV}"))`);
  lines.push('    resp, err := http.DefaultClient.Do(req)');
  lines.push('    if err != nil { panic(err) }');
  lines.push('    defer resp.Body.Close()');
  lines.push('    out, _ := io.ReadAll(resp.Body)');
  lines.push('    fmt.Println(string(out))');
  lines.push('}');
  return { lang: 'Go', highlight: 'go', source: lines.join('\n') };
}

/* ── Ruby ──────────────────────────────────────────────────────────────── */

export function rubySample(spec: EndpointSpec): CodeSample {
  const apiPath = toOpenApiPath(spec.path);
  const verb = {
    GET: 'Net::HTTP::Get',
    POST: 'Net::HTTP::Post',
    PATCH: 'Net::HTTP::Patch',
    PUT: 'Net::HTTP::Put',
    DELETE: 'Net::HTTP::Delete',
  }[spec.method];
  const lines = [
    "require 'net/http'",
    "require 'json'",
    "require 'uri'",
    '',
    `uri = URI('${BASE}${apiPath}')`,
    `req = ${verb}.new(uri)`,
    `req['Authorization'] = "Bearer #{ENV['${KEY_ENV}']}"`,
  ];
  if (hasBody(spec)) {
    lines.push(`req['Content-Type'] = 'application/json'`);
    lines.push('req.body = {}.to_json');
  }
  lines.push('res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |h| h.request(req) }');
  lines.push('puts res.body');
  return { lang: 'Ruby', highlight: 'ruby', source: lines.join('\n') };
}

/* ── PHP ───────────────────────────────────────────────────────────────── */

export function phpSample(spec: EndpointSpec): CodeSample {
  const apiPath = toOpenApiPath(spec.path);
  const lines = [
    '<?php',
    `$ch = curl_init('${BASE}${apiPath}');`,
    'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);',
    `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${spec.method}');`,
    `curl_setopt($ch, CURLOPT_HTTPHEADER, [`,
    `    'Authorization: Bearer ' . getenv('${KEY_ENV}'),`,
    hasBody(spec) ? `    'Content-Type: application/json',` : null,
    `]);`,
  ].filter(Boolean) as string[];
  if (hasBody(spec)) lines.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([]));`);
  lines.push('$response = curl_exec($ch);');
  lines.push('curl_close($ch);');
  lines.push('echo $response;');
  return { lang: 'PHP', highlight: 'php', source: lines.join('\n') };
}

/* ── Java (HttpClient, JDK 11+) ────────────────────────────────────────── */

export function javaSample(spec: EndpointSpec): CodeSample {
  const apiPath = toOpenApiPath(spec.path);
  const lines = [
    'import java.net.URI;',
    'import java.net.http.HttpClient;',
    'import java.net.http.HttpRequest;',
    'import java.net.http.HttpResponse;',
    '',
    'public class Example {',
    '    public static void main(String[] args) throws Exception {',
    '        var client = HttpClient.newHttpClient();',
    '        var req = HttpRequest.newBuilder()',
    `            .uri(URI.create("${BASE}${apiPath}"))`,
    `            .header("Authorization", "Bearer " + System.getenv("${KEY_ENV}"))`,
  ];
  if (hasBody(spec)) {
    lines.push('            .header("Content-Type", "application/json")');
    lines.push(`            .method("${spec.method}", HttpRequest.BodyPublishers.ofString("{}"))`);
  } else {
    lines.push(`            .method("${spec.method}", HttpRequest.BodyPublishers.noBody())`);
  }
  lines.push('            .build();');
  lines.push('        var resp = client.send(req, HttpResponse.BodyHandlers.ofString());');
  lines.push('        System.out.println(resp.body());');
  lines.push('    }');
  lines.push('}');
  return { lang: 'Java', highlight: 'java', source: lines.join('\n') };
}

/* ── C# / .NET ─────────────────────────────────────────────────────────── */

export function csharpSample(spec: EndpointSpec): CodeSample {
  const apiPath = toOpenApiPath(spec.path);
  const lines = [
    'using System.Net.Http;',
    'using System.Net.Http.Headers;',
    'using System.Text;',
    'using System.Threading.Tasks;',
    '',
    'var http = new HttpClient();',
    `var req = new HttpRequestMessage(HttpMethod.${
      { GET: 'Get', POST: 'Post', PATCH: 'Patch', PUT: 'Put', DELETE: 'Delete' }[spec.method]
    }, "${BASE}${apiPath}");`,
    `req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Environment.GetEnvironmentVariable("${KEY_ENV}"));`,
  ];
  if (hasBody(spec)) {
    lines.push('req.Content = new StringContent("{}", Encoding.UTF8, "application/json");');
  }
  lines.push('var resp = await http.SendAsync(req);');
  lines.push('Console.WriteLine(await resp.Content.ReadAsStringAsync());');
  return { lang: 'C#', highlight: 'csharp', source: lines.join('\n') };
}

/* ── Rust (reqwest) ────────────────────────────────────────────────────── */

export function rustSample(spec: EndpointSpec): CodeSample {
  const apiPath = toOpenApiPath(spec.path);
  const reqwestMethod = spec.method.toLowerCase();
  const lines = [
    '// Cargo.toml: reqwest = { version = "0.12", features = ["json"] }, tokio = { version = "1", features = ["macros", "rt-multi-thread"] }',
    'use std::env;',
    '',
    '#[tokio::main]',
    'async fn main() -> Result<(), Box<dyn std::error::Error>> {',
    '    let client = reqwest::Client::new();',
    `    let req = client.${reqwestMethod}("${BASE}${apiPath}")`,
    `        .bearer_auth(env::var("${KEY_ENV}")?)`,
  ];
  if (hasBody(spec)) lines.push('        .json(&serde_json::json!({}))');
  lines.push('        .send().await?;');
  lines.push('    println!("{}", req.text().await?);');
  lines.push('    Ok(())');
  lines.push('}');
  return { lang: 'Rust', highlight: 'rust', source: lines.join('\n') };
}

/* ── Elixir (HTTPoison) ────────────────────────────────────────────────── */

export function elixirSample(spec: EndpointSpec): CodeSample {
  const apiPath = toOpenApiPath(spec.path);
  const headers = [`{"Authorization", "Bearer #{System.get_env(\"${KEY_ENV}\")}"}`];
  if (hasBody(spec)) headers.push(`{"Content-Type", "application/json"}`);
  const lines = [
    'headers = [',
    '  ' + headers.join(',\n  '),
    ']',
    '',
  ];
  if (hasBody(spec)) {
    lines.push('body = Jason.encode!(%{})');
    lines.push(`{:ok, resp} = HTTPoison.request(:${spec.method.toLowerCase()}, "${BASE}${apiPath}", body, headers)`);
  } else {
    lines.push(`{:ok, resp} = HTTPoison.${spec.method.toLowerCase()}("${BASE}${apiPath}", headers)`);
  }
  lines.push('IO.puts(resp.body)');
  return { lang: 'Elixir', highlight: 'elixir', source: lines.join('\n') };
}

/* ── Swift (URLSession) ────────────────────────────────────────────────── */

export function swiftSample(spec: EndpointSpec): CodeSample {
  const apiPath = toOpenApiPath(spec.path);
  const lines = [
    'import Foundation',
    '',
    `var req = URLRequest(url: URL(string: "${BASE}${apiPath}")!)`,
    `req.httpMethod = "${spec.method}"`,
    `req.addValue("Bearer \\(ProcessInfo.processInfo.environment["${KEY_ENV}"] ?? "")", forHTTPHeaderField: "Authorization")`,
  ];
  if (hasBody(spec)) {
    lines.push('req.addValue("application/json", forHTTPHeaderField: "Content-Type")');
    lines.push('req.httpBody = "{}".data(using: .utf8)');
  }
  lines.push('let (data, _) = try await URLSession.shared.data(for: req)');
  lines.push('print(String(data: data, encoding: .utf8) ?? "")');
  return { lang: 'Swift', highlight: 'swift', source: lines.join('\n') };
}

/* ── Kotlin (OkHttp) ───────────────────────────────────────────────────── */

export function kotlinSample(spec: EndpointSpec): CodeSample {
  const apiPath = toOpenApiPath(spec.path);
  const lines = [
    'import okhttp3.*',
    '',
    'val client = OkHttpClient()',
    'val builder = Request.Builder()',
    `    .url("${BASE}${apiPath}")`,
    `    .addHeader("Authorization", "Bearer \${System.getenv("${KEY_ENV}")}")`,
  ];
  if (hasBody(spec)) {
    lines.push('val body = "{}".toRequestBody("application/json".toMediaType())');
    lines.push(`builder.method("${spec.method}", body)`);
  } else if (spec.method !== 'GET') {
    lines.push(`builder.method("${spec.method}", null)`);
  }
  lines.push('client.newCall(builder.build()).execute().use { resp -> println(resp.body?.string()) }');
  return { lang: 'Kotlin', highlight: 'kotlin', source: lines.join('\n') };
}

/* ── Ordered roster ────────────────────────────────────────────────────── */

export const LANGUAGES: ReadonlyArray<(spec: EndpointSpec) => CodeSample> = [
  curlSample,
  httpSample,
  jsSample,
  tsSdkSample,
  pythonRequestsSample,
  pythonHttpxSample,
  goSample,
  rubySample,
  phpSample,
  javaSample,
  csharpSample,
  rustSample,
  elixirSample,
  swiftSample,
  kotlinSample,
];

export function buildAllSamples(spec: EndpointSpec): CodeSample[] {
  return LANGUAGES.map((fn) => fn(spec));
}
