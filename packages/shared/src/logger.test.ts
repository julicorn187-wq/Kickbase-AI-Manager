import { describe, expect, it } from "vitest";
import { createLogger } from "./logger.js";

describe("createLogger", () => {
  it("emits structured JSON with level and message", () => {
    const lines: string[] = [];
    const logger = createLogger({ sink: (line) => lines.push(line) });

    logger.info("hello", { foo: "bar" });

    expect(lines).toHaveLength(1);
    const [line] = lines;
    if (!line) throw new Error("expected a log line");
    const entry = JSON.parse(line) as Record<string, unknown>;
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("hello");
    expect(entry.foo).toBe("bar");
  });

  it("redacts cookie/token/password fields regardless of case", () => {
    const lines: string[] = [];
    const logger = createLogger({ sink: (line) => lines.push(line) });

    logger.info("request made", { KB_COOKIE: "super-secret", token: "abc", ok: true });

    const [line] = lines;
    if (!line) throw new Error("expected a log line");
    const entry = JSON.parse(line) as Record<string, unknown>;
    expect(entry.KB_COOKIE).toBe("[REDACTED]");
    expect(entry.token).toBe("[REDACTED]");
    expect(entry.ok).toBe(true);
  });

  it("suppresses levels below minLevel", () => {
    const lines: string[] = [];
    const logger = createLogger({ minLevel: "warn", sink: (line) => lines.push(line) });

    logger.info("should not appear");
    logger.debug("should not appear either");
    logger.warn("should appear");

    expect(lines).toHaveLength(1);
  });
});
