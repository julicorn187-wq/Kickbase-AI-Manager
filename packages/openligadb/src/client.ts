import { createLogger, type Logger } from "@kickbase-ai-manager/shared";
import { OpenLigaApiError, OpenLigaNetworkError, OpenLigaParseError } from "./errors.js";
import type { OpenLigaLeagueInfo, OpenLigaMatch } from "./types.js";

export const OPENLIGADB_API_BASE = "https://api.openligadb.de";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export interface OpenLigaDbClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  logger?: Logger;
  timeoutMs?: number;
  maxRetries?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Client for the free, publicly documented OpenLigaDB API (no auth). Same
 * retry/timeout shape as KickbaseApiClient; kept as a separate small
 * implementation rather than sharing code with it for now since that client
 * also handles bearer-token auth and league-scoped URLs that don't apply here —
 * see PLAN.md for the note to revisit extracting a shared fetch-retry
 * helper if a third client ever needs the same logic.
 */
export class OpenLigaDbClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly logger: Logger;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: OpenLigaDbClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? OPENLIGADB_API_BASE;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.logger = options.logger ?? createLogger();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  private async makeRequest<T>(endpoint: string): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, this.timeoutMs);

      try {
        const response = await this.fetchImpl(`${this.baseUrl}${endpoint}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this.maxRetries) {
            lastError = new OpenLigaApiError(
              `OpenLigaDB error (status ${response.status}) at ${endpoint}`,
              endpoint,
              response.status,
            );
            await this.backoff(attempt, response);
            continue;
          }
          throw new OpenLigaApiError(
            `OpenLigaDB error (status ${response.status}) at ${endpoint}`,
            endpoint,
            response.status,
          );
        }

        try {
          return (await response.json()) as T;
        } catch (parseError) {
          throw new OpenLigaParseError(endpoint, parseError);
        }
      } catch (error) {
        clearTimeout(timeout);

        if (error instanceof OpenLigaApiError) {
          throw error;
        }

        lastError = error;
        if (attempt < this.maxRetries) {
          this.logger.warn("openligadb request failed, retrying", {
            endpoint,
            attempt,
            error: String(error),
          });
          await this.backoff(attempt);
          continue;
        }
        throw new OpenLigaNetworkError(endpoint, error);
      }
    }

    throw lastError instanceof Error ? lastError : new OpenLigaNetworkError(endpoint, lastError);
  }

  private async backoff(attempt: number, response?: Response): Promise<void> {
    const retryAfterHeader = response?.headers.get("Retry-After");
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
    const backoffMs = retryAfterMs ?? 2 ** attempt * 250;
    await sleep(backoffMs);
  }

  /** All matches for one league/season, played and upcoming. */
  async getSeasonMatches(leagueShortcut: string, season: number): Promise<OpenLigaMatch[]> {
    this.logger.info("fetching openligadb season matches", { leagueShortcut, season });
    return this.makeRequest<OpenLigaMatch[]>(`/getmatchdata/${leagueShortcut}/${season}`);
  }

  /** Every league/season combination OpenLigaDB has data for. Used to discover the current-season shortcut for competitions whose shortcut changes yearly (DFB-Pokal, Champions League, ...). */
  async getAvailableLeagues(): Promise<OpenLigaLeagueInfo[]> {
    this.logger.info("fetching openligadb available leagues");
    return this.makeRequest<OpenLigaLeagueInfo[]>("/getavailableleagues");
  }
}
