import { z } from "zod";

const envSchema = z.object({
  KB_COOKIE: z.string().min(1, "KB_COOKIE is required (Kickbase session cookie)"),
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
 * a raw ZodError, and never echoes the KB_COOKIE value.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => issue.message);
    throw new EnvValidationError(issues);
  }
  return result.data;
}
