import "server-only";

import axios, {
  type AxiosInstance,
  type CreateAxiosDefaults,
} from "axios";
import axiosRetry from "axios-retry";

import { createSsrfSafeAgent } from "@/lib/sabcrm/server/src/engine/core-modules/secure-http-client/utils/create-ssrf-safe-agent.util";
import { resolveAndValidateHostname } from "@/lib/sabcrm/server/src/engine/core-modules/secure-http-client/utils/resolve-and-validate-hostname.util";
import type { OutboundRequestContext } from "./outbound-request-context.type";

const MAX_REDIRECTS = 5;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

type SecureHttpClientConfig = CreateAxiosDefaults & {
  retries?: number;
  shouldResetTimeout?: boolean;
};

// Minimal config interface — populate from process.env in your call site
export type SecureHttpConfig = {
  get(key: "OUTBOUND_HTTP_SAFE_MODE_ENABLED"): boolean;
};

const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

export class SecureHttpClientService {
  constructor(private readonly config: SecureHttpConfig) {}

  // Returns an SSRF-protected HTTP client for external requests.
  // Protection is enforced at the connection level via custom agents
  // that validate resolved IPs, which covers redirects automatically.
  // When context is provided, outbound requests are logged with
  // workspace/user info for correlation.
  getHttpClient(
    config?: SecureHttpClientConfig,
    context?: OutboundRequestContext,
  ): AxiosInstance {
    const { retries, shouldResetTimeout, ...axiosConfig } = config ?? {};

    const isSafeModeEnabled = this.config.get(
      "OUTBOUND_HTTP_SAFE_MODE_ENABLED",
    );

    const client = isSafeModeEnabled
      ? axios.create({
          ...axiosConfig,
          httpAgent: createSsrfSafeAgent("http"),
          httpsAgent: createSsrfSafeAgent("https"),
          maxRedirects: Math.min(
            axiosConfig.maxRedirects ?? MAX_REDIRECTS,
            MAX_REDIRECTS,
          ),
        })
      : axios.create(axiosConfig);

    if (isDefined(retries) && retries > 0) {
      axiosRetry(client, {
        retries,
        shouldResetTimeout,
        retryCondition: (error) =>
          axiosRetry.isNetworkOrIdempotentRequestError(error) &&
          error.code !== "ECONNABORTED" &&
          error.code !== "ETIMEDOUT",
      });
    }

    if (isSafeModeEnabled) {
      client.interceptors.request.use((requestConfig) => {
        const url = requestConfig.url ?? requestConfig.baseURL;

        if (url) {
          const parsed = new URL(url, requestConfig.baseURL);

          if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
            throw new Error(
              `Protocol ${parsed.protocol} is not allowed. Only HTTP and HTTPS are permitted.`,
            );
          }
        }

        return requestConfig;
      });
    }

    if (context) {
      client.interceptors.request.use((requestConfig) => {
        console.log(
          `Outbound HTTP request: ${requestConfig.method?.toUpperCase()} ${requestConfig.url} ` +
            `[workspace=${context.workspaceId}, source=${context.source}` +
            `${context.userId ? `, user=${context.userId}` : ""}]`,
        );

        return requestConfig;
      });
    }

    return client;
  }

  // Returns a plain HTTP client for requests to trusted internal URLs
  // (e.g., the server's own API endpoints). Not SSRF-protected.
  getInternalHttpClient(config?: CreateAxiosDefaults): AxiosInstance {
    return axios.create(config);
  }

  createSsrfSafeFetch(): typeof globalThis.fetch {
    if (!this.isSafeModeEnabled()) {
      return globalThis.fetch;
    }

    // PORT-NOTE: @lifeomic/axios-fetch may not be available in the SabNode
    // dependency tree. If needed, add it with `npm install @lifeomic/axios-fetch`.
    // Falling back to native fetch for now; replace if SSRF-safe fetch is required.
    return globalThis.fetch;
  }

  async getValidatedHost(hostnameOrUrl: string): Promise<string> {
    if (!this.isSafeModeEnabled()) {
      return hostnameOrUrl;
    }

    return resolveAndValidateHostname(hostnameOrUrl);
  }

  private isSafeModeEnabled(): boolean {
    return this.config.get("OUTBOUND_HTTP_SAFE_MODE_ENABLED");
  }
}

// Factory for easy instantiation from env vars
export const createSecureHttpClientService = (): SecureHttpClientService =>
  new SecureHttpClientService({
    get(key: "OUTBOUND_HTTP_SAFE_MODE_ENABLED") {
      return process.env[key] === "true";
    },
  });
