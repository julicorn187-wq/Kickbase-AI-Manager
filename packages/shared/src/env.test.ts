import { describe, expect, it } from "vitest";
import { EnvValidationError, loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("parses a valid environment, defaulting ENABLE_BASEXI to false", () => {
    const env = loadEnv({ KB_COOKIE: "session-abc", LEAGUE_ID: "12345" });
    expect(env).toEqual({ KB_COOKIE: "session-abc", LEAGUE_ID: "12345", ENABLE_BASEXI: false });
  });

  it("only enables BaseXI when ENABLE_BASEXI is exactly the string 'true'", () => {
    expect(loadEnv({ KB_COOKIE: "c", LEAGUE_ID: "1", ENABLE_BASEXI: "true" }).ENABLE_BASEXI).toBe(true);
    expect(loadEnv({ KB_COOKIE: "c", LEAGUE_ID: "1", ENABLE_BASEXI: "yes" }).ENABLE_BASEXI).toBe(false);
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
