/**
 * ============================================================================
 * OPT-IN, NON-DEFAULT INTEGRATION — READ BEFORE USING
 * ============================================================================
 * base-xi.de's own robots.txt disallows automated access to /api/ (confirmed by
 * inspection: "User-agent: *" / "Disallow: /api/"). This client exists ONLY
 * because a maintainer explicitly asked for it for their own personal use with
 * full knowledge of that conflict — it is never constructed unless the
 * ENABLE_BASEXI env var is "true" (see packages/shared/src/env.ts and
 * KickbaseMcpServer). Do not remove that gate, and do not call this client from
 * any code path that isn't behind it. See CLAUDE.md's "External data sources"
 * section for the full reasoning.
 * ============================================================================
 */
import { createLogger, type Logger } from "@kickbase-ai-manager/shared";
import { BaseXiApiError, BaseXiNetworkError, BaseXiParseError } from "./errors.js";
import type { BaseXiPlayer, BaseXiPlayerDetail } from "./types.js";

interface BaseXiModalResponse {
  success: boolean;
  data?: BaseXiPlayerDetail;
  error?: string;
}

export const BASEXI_API_BASE = "https://www.base-xi.de";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 1; // deliberately low — this integration should be light-touch
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export interface BaseXiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  logger?: Logger;
  timeoutMs?: number;
  maxRetries?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class BaseXiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly logger: Logger;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: BaseXiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? BASEXI_API_BASE;
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
          headers: { Accept: "application/json" },
        });
        clearTimeout(timeout);

        if (!response.ok) {
          if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this.maxRetries) {
            lastError = new BaseXiApiError(
              `BaseXI error (status ${response.status}) at ${endpoint}`,
              endpoint,
              response.status,
            );
            await this.backoff(attempt, response);
            continue;
          }
          throw new BaseXiApiError(`BaseXI error (status ${response.status}) at ${endpoint}`, endpoint, response.status);
        }

        try {
          return (await response.json()) as T;
        } catch (parseError) {
          throw new BaseXiParseError(endpoint, parseError);
        }
      } catch (error) {
        clearTimeout(timeout);

        if (error instanceof BaseXiApiError) {
          throw error;
        }

        lastError = error;
        if (attempt < this.maxRetries) {
          this.logger.warn("basexi request failed, retrying", { endpoint, attempt, error: String(error) });
          await this.backoff(attempt);
          continue;
        }
        throw new BaseXiNetworkError(endpoint, error);
      }
    }

    throw lastError instanceof Error ? lastError : new BaseXiNetworkError(endpoint, lastError);
  }

  private async backoff(attempt: number, response?: Response): Promise<void> {
    const retryAfterHeader = response?.headers.get("Retry-After");
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
    const backoffMs = retryAfterMs ?? 2 ** attempt * 500;
    await sleep(backoffMs);
  }

  /** All players currently known to BaseXI (Bundesliga + 2. Bundesliga). */
  async getAllPlayers(): Promise<BaseXiPlayer[]> {
    this.logger.info("fetching basexi players");
    return this.makeRequest<BaseXiPlayer[]>("/api/players");
  }

  /** Case-insensitive substring match on name — same loose-matching approach used for OpenLigaDB team names. */
  async findPlayer(name: string): Promise<BaseXiPlayer | undefined> {
    const players = await this.getAllPlayers();
    const needle = name.toLowerCase().trim();
    return players.find((p) => p.name.toLowerCase().includes(needle));
  }

  /**
   * Per-player detail with REAL per-matchday point history for the current
   * and previous season — discovered via the site's own player-detail modal
   * (not documented anywhere; the endpoint and shape were found by reading
   * base-xi.de's own frontend JS, see PLAN.md). comp selects competition:
   * 1 = Bundesliga, 2 = 2. Bundesliga.
   */
  async getPlayerDetail(playerId: string, comp: 1 | 2 = 1): Promise<BaseXiPlayerDetail> {
    this.logger.info("fetching basexi player detail", { playerId, comp });
    const endpoint = `/api/modal/player/${playerId}?comp=${String(comp)}`;
    const response = await this.makeRequest<BaseXiModalResponse>(endpoint);
    if (!response.success || !response.data) {
      throw new BaseXiApiError(`BaseXI modal API reported failure: ${response.error ?? "unknown error"}`, endpoint);
    }
    return response.data;
  }
}
