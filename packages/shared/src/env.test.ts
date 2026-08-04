import { describe, expect, it } from "vitest";
import { EnvValidationError, loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("parses a valid environment", () => {
    const env = loadEnv({ KB_COOKIE: "session-abc", LEAGUE_ID: "12345" });
    expect(env).toEqual({ KB_COOKIE: "session-abc", LEAGUE_ID: "12345" });
  });

  it("throws EnvValidationError with actionable messages when KB_COOKIE is missing", () => {
    expect(() => loadEnv({ LEAGUE_ID: "12345" })).toThrow(EnvValidationError);
  });

  it("throws EnvValidationError when LEAGUE_ID is missing", () => {
    expect(() => loadEnv({ KB_COOKIE: "session-abc" })).toThrow(EnvValidationError);
  });

  it("lists every failing field in the error", () => {
    try {
      loadEnv({});
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const issues = (error as EnvValidationError).issues;
      expect(issues.length).toBe(2);
    }
  });
});
