import { createLogger, type Logger } from "@kickbase-ai-manager/shared";
import { KickbaseApiError, KickbaseAuthError, KickbaseNetworkError, KickbaseParseError } from "./errors.js";
import type {
  LeagueRankingData,
  MarketValueData,
  PlayerData,
  PlayerMarketItem,
  SquadData,
} from "./types.js";

export const KICKBASE_API_BASE = "https://api.kickbase.com/v4";
export const DEFAULT_MARKET_VALUE_TIMEFRAME_DAYS = 92;

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export interface KickbaseApiClientOptions {
  /** Kickbase session cookie value. Required — never falls back to process.env implicitly. */
  cookie: string;
  /** League id this client talks to. Configurable per instance, not process-wide. */
  leagueId: string;
  /** Override the API base URL (mainly for tests). */
  baseUrl?: string;
  /** Override fetch (mainly for tests). */
  fetchImpl?: typeof fetch;
  /** Structured logger; defaults to a shared JSON logger with cookies redacted. */
  logger?: Logger;
  /** Per-request timeout in ms. */
  timeoutMs?: number;
  /** Number of retries for transient failures (timeouts, network errors, 5xx, 429). */
  maxRetries?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class KickbaseApiClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;
  private readonly logger: Logger;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: KickbaseApiClientOptions) {
    const apiBase = options.baseUrl ?? KICKBASE_API_BASE;
    this.baseUrl = `${apiBase}/leagues/${options.leagueId}`;
    this.headers = {
      Cookie: options.cookie,
      "Content-Type": "application/json",
    };
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.logger = options.logger ?? createLogger();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  private async makeRequest<T>(
    endpoint: string,
    init: Omit<RequestInit, "headers"> & { headers?: Record<string, string> } = {},
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, this.timeoutMs);

      try {
        const response = await this.fetchImpl(`${this.baseUrl}${endpoint}`, {
          ...init,
          headers: { ...this.headers, ...init.headers },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.status === 401 || response.status === 403) {
          throw new KickbaseAuthError(endpoint, response.status);
        }

        if (!response.ok) {
          if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this.maxRetries) {
            lastError = new KickbaseApiError(
              `Kickbase API error (status ${response.status}) at ${endpoint}`,
              endpoint,
              response.status,
            );
            await this.backoff(attempt, response);
            continue;
          }
          throw new KickbaseApiError(
            `Kickbase API error (status ${response.status}) at ${endpoint}`,
            endpoint,
            response.status,
          );
        }

        try {
          const data = (await response.json()) as T;
          this.logger.debug("kickbase api response", { endpoint, data });
          return data;
        } catch (parseError) {
          throw new KickbaseParseError(endpoint, parseError);
        }
      } catch (error) {
        clearTimeout(timeout);

        if (error instanceof KickbaseAuthError || error instanceof KickbaseParseError) {
          throw error;
        }
        if (error instanceof KickbaseApiError) {
          throw error;
        }

        lastError = error;
        if (attempt < this.maxRetries) {
          this.logger.warn("kickbase api request failed, retrying", {
            endpoint,
            attempt,
            error: String(error),
          });
          await this.backoff(attempt);
          continue;
        }
        throw new KickbaseNetworkError(endpoint, error);
      }
    }

    throw lastError instanceof Error ? lastError : new KickbaseNetworkError(endpoint, lastError);
  }

  private async backoff(attempt: number, response?: Response): Promise<void> {
    const retryAfterHeader = response?.headers.get("Retry-After");
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
    const backoffMs = retryAfterMs ?? 2 ** attempt * 250;
    await sleep(backoffMs);
  }

  async getMarketPlayers(): Promise<{ it: PlayerMarketItem[] }> {
    this.logger.info("fetching market data");
    return this.makeRequest<{ it: PlayerMarketItem[] }>("/market");
  }

  async getPlayerData(playerId: string): Promise<PlayerData> {
    this.logger.info("fetching player data", { playerId });
    return this.makeRequest<PlayerData>(`/players/${playerId}`);
  }

  async getPlayerMarketValue(
    playerId: string,
    timeframeDays: number = DEFAULT_MARKET_VALUE_TIMEFRAME_DAYS,
  ): Promise<MarketValueData> {
    this.logger.info("fetching player market value", { playerId, timeframeDays });
    return this.makeRequest<MarketValueData>(`/players/${playerId}/marketvalue/${timeframeDays}`);
  }

  async getMySquad(): Promise<SquadData> {
    this.logger.info("fetching squad data");
    return this.makeRequest<SquadData>("/squad");
  }

  /**
   * Fetches the league ranking table. Pass dayNumber for a single
   * matchday's standings; omit it for the season-overall ranking.
   */
  async getLeagueRanking(dayNumber?: number): Promise<LeagueRankingData> {
    this.logger.info("fetching league ranking", { dayNumber });
    const query = dayNumber === undefined ? "" : `?dayNumber=${dayNumber}`;
    return this.makeRequest<LeagueRankingData>(`/ranking${query}`);
  }

  /**
   * Places a real offer on the Kickbase market. This is a budget-affecting,
   * hard-to-reverse action — callers (the MCP tool layer) are responsible for
   * the dry-run/confirmation guardrail; this method always executes.
   */
  async makeOffer(playerId: string, price: number): Promise<void> {
    this.logger.info("submitting market offer", { playerId, price });
    await this.makeRequest(`/market/${playerId}/offers`, {
      method: "POST",
      body: JSON.stringify({ price }),
    });
  }
}
