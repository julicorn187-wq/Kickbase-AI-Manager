import { z } from "zod";

const envSchema = z.object({
  /**
   * Kickbase auth token, sent as `Authorization: Bearer <KB_TOKEN>`. Named
   * KB_TOKEN, not KB_COOKIE — the app authenticates this way, confirmed by
   * inspecting its real network traffic (2026-08-08); there is no cookie
   * involved. Short-lived (~1 hour observed) — expect to refresh it often.
   */
  KB_TOKEN: z.string().min(1, "KB_TOKEN is required (Kickbase auth token)"),
  LEAGUE_ID: z.string().min(1, "LEAGUE_ID is required (Kickbase league id)"),
  /**
   * Opt-in for the BaseXI integration (packages/basexi). Off by default: BaseXI's
   * /api/ path is disallowed by its own robots.txt, so this project never calls it
   * unless a maintainer explicitly turns it on for their own personal use — see
   * CLAUDE.md's "External data sources" section before setting this to "true".
   */
  ENABLE_BASEXI: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  /**
   * Directory the opt-in matchday forecast tool logs its predictions to, so
   * a later run can diff them against real results (see
   * packages/mcp-server/src/forecast-log.ts). Defaults to
   * ./.kickbase-forecast-log when unset.
   */
  FORECAST_LOG_DIR: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join("\n")}`);
    this.name = "EnvValidationError";
  }
}

/**
 * Parses and validates process env for required Kickbase credentials.
 * Throws EnvValidationError with actionable messages instead of surfacing
 * a raw ZodError, and never echoes the KB_TOKEN value.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => issue.message);
    throw new EnvValidationError(issues);
  }
  return result.data;
}
